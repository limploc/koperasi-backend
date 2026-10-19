import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto.js';
import { AdminUpdateOrderStatusDto } from './dto/admin-update-order-status.dto.js';
import {
  AdminOrderResponse,
  mapAdminOrderToResponse,
  OrderWithRelations,
} from './admin.mapper.js';
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
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AdminOrderQueryDto,
  ): Promise<{ data: AdminOrderResponse[]; meta: PaginationMetaResponse }> {
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
      data: (orders as OrderWithRelations[]).map(mapAdminOrderToResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateStatus(
    orderId: string,
    dto: AdminUpdateOrderStatusDto,
  ): Promise<AdminOrderResponse> {
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
        return mapAdminOrderToResponse(refreshed as OrderWithRelations);
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

      return mapAdminOrderToResponse(refreshed as OrderWithRelations);
    });
  }
}
