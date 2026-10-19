import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartItemType,
  OrderStatus,
  OrderType,
  RentalDurationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import {
  mapOrderToResponse,
  OrderResponse,
  OrderWithRelations,
} from './orders.mapper.js';
import { PaginationMetaResponse } from '../products/products.mapper.js';

const ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          seller: {
            select: {
              id: true,
              email: true,
              phone_number: true,
              role: true,
              created_at: true,
            },
          },
        },
      },
      rental_item: true,
    },
    orderBy: {
      created_at: 'asc' as const,
    },
  },
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(buyerId: string): Promise<OrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { buyer_id: buyerId },
        include: {
          items: true,
        },
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException({
          message: 'Cart empty or insufficient stock',
          code: 'VALIDATION_ERROR',
          details: { cart: ['Cart is empty'] },
        });
      }

      let totalAmount = 0;
      let hasRental = false;
      const orderItemsToCreate: Array<{
        product_id?: string | null;
        rental_item_id?: string | null;
        quantity: number;
        price: number;
        price_snapshot: number;
        subtotal: number;
        duration_type?: RentalDurationType | null;
        item_type: CartItemType;
      }> = [];

      for (const item of cart.items) {
        if (item.product_id) {
          const product = await tx.product.findUnique({
            where: { id: item.product_id },
          });

          if (!product || product.stock < item.quantity) {
            throw new BadRequestException({
              message: 'Cart empty or insufficient stock',
              code: 'VALIDATION_ERROR',
              details: {
                stock: [`Insufficient stock for product ${product?.name ?? item.product_id}`],
              },
            });
          }

          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });

          const price = product.price;
          const subtotal = item.quantity * price;
          totalAmount += subtotal;

          orderItemsToCreate.push({
            product_id: product.id,
            quantity: item.quantity,
            price,
            price_snapshot: price,
            subtotal,
            item_type: CartItemType.product,
          });
        } else if (item.rental_item_id) {
          const rental = await tx.rentalItem.findUnique({
            where: { id: item.rental_item_id },
          });

          if (!rental || rental.available_units < item.quantity) {
            throw new BadRequestException({
              message: 'Cart empty or insufficient stock',
              code: 'VALIDATION_ERROR',
              details: {
                stock: [`Insufficient units for rental item ${rental?.name ?? item.rental_item_id}`],
              },
            });
          }

          await tx.rentalItem.update({
            where: { id: rental.id },
            data: { available_units: { decrement: item.quantity } },
          });

          let price =
            rental.price_per_day ?? rental.price_per_hour ?? rental.price_per_week ?? 0;
          if (item.duration_type === RentalDurationType.hour && rental.price_per_hour != null) {
            price = rental.price_per_hour;
          } else if (item.duration_type === RentalDurationType.day && rental.price_per_day != null) {
            price = rental.price_per_day;
          } else if (item.duration_type === RentalDurationType.week && rental.price_per_week != null) {
            price = rental.price_per_week;
          }

          const subtotal = item.quantity * price;
          totalAmount += subtotal;
          hasRental = true;

          orderItemsToCreate.push({
            rental_item_id: rental.id,
            quantity: item.quantity,
            price,
            price_snapshot: price,
            subtotal,
            duration_type: item.duration_type ?? null,
            item_type: CartItemType.rental,
          });
        }
      }

      const orderType = hasRental ? OrderType.EQUIPMENT_RENTAL : OrderType.PRODUCT_PURCHASE;

      const order = await tx.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: totalAmount,
          status: OrderStatus.pending,
          order_type: orderType,
          items: {
            create: orderItemsToCreate,
          },
        },
        include: ORDER_INCLUDE,
      });

      await tx.cartItem.deleteMany({
        where: { cart_id: cart.id },
      });

      return mapOrderToResponse(order as OrderWithRelations);
    });
  }

  async findAllBuyerOrders(
    buyerId: string,
    query: OrderQueryDto,
  ): Promise<{ data: OrderResponse[]; meta: PaginationMetaResponse }> {
    const where = {
      buyer_id: buyerId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        include: ORDER_INCLUDE,
      }),
    ]);

    return {
      data: (orders as OrderWithRelations[]).map(mapOrderToResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(
    orderId: string,
    currentUser: { sub: string; role: UserRole },
  ): Promise<OrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (currentUser.role !== UserRole.SUPERADMIN && order.buyer_id !== currentUser.sub) {
      throw new ForbiddenException({
        message: 'Forbidden',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    return mapOrderToResponse(order as OrderWithRelations);
  }

  async payOrder(
    orderId: string,
    currentUser: { sub: string; role: UserRole },
    dto: PayOrderDto,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      if (currentUser.role !== UserRole.SUPERADMIN && order.buyer_id !== currentUser.sub) {
        throw new ForbiddenException({
          message: 'Forbidden',
          code: 'FORBIDDEN_ACCESS',
        });
      }

      if (order.status !== OrderStatus.pending) {
        throw new BadRequestException({
          message: 'Order not in pending status',
          code: 'VALIDATION_ERROR',
          details: { status: ['Order is not in pending status'] },
        });
      }

      const outcome = dto.simulate ?? 'success';

      if (outcome === 'failure') {
        for (const item of order.items) {
          if (item.product_id) {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.rental_item_id) {
            await tx.rentalItem.update({
              where: { id: item.rental_item_id },
              data: { available_units: { increment: item.quantity } },
            });
          }
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.failed },
        });
      } else {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.paid },
        });
      }

      const refreshed = await tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });

      return mapOrderToResponse(refreshed as OrderWithRelations);
    });
  }

  async adminFindAllOrders(
    query: AdminOrderQueryDto,
  ): Promise<{ data: OrderResponse[]; meta: PaginationMetaResponse }> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.buyer_id ? { buyer_id: query.buyer_id } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
        include: ORDER_INCLUDE,
      }),
    ]);

    return {
      data: (orders as OrderWithRelations[]).map(mapOrderToResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async adminUpdateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      if (order.status === dto.status) {
        const refreshed = await tx.order.findUnique({
          where: { id: orderId },
          include: ORDER_INCLUDE,
        });
        return mapOrderToResponse(refreshed as OrderWithRelations);
      }

      if (order.status === OrderStatus.failed) {
        throw new BadRequestException({
          message: 'Cannot update status of a failed order',
          code: 'VALIDATION_ERROR',
        });
      }

      if (dto.status === OrderStatus.failed) {
        for (const item of order.items) {
          if (item.product_id) {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.rental_item_id) {
            await tx.rentalItem.update({
              where: { id: item.rental_item_id },
              data: { available_units: { increment: item.quantity } },
            });
          }
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: dto.status },
      });

      const refreshed = await tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });

      return mapOrderToResponse(refreshed as OrderWithRelations);
    });
  }
}
