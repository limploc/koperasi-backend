import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartItemType, RentalDurationType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { CartResponse, CartWithItems, mapCartToResponse } from './cart.mapper.js';

const CART_INCLUDE = {
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
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(buyerId: string): Promise<CartWithItems> {
    let cart = await this.prisma.cart.findUnique({
      where: { buyer_id: buyerId },
      include: CART_INCLUDE,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { buyer_id: buyerId },
        include: CART_INCLUDE,
      });
    }

    return cart as CartWithItems;
  }

  private async fetchCartById(cartId: string): Promise<CartWithItems> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: CART_INCLUDE,
    });
    return cart as CartWithItems;
  }

  async getCart(buyerId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(buyerId);
    return mapCartToResponse(cart);
  }

  async clearCart(buyerId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(buyerId);
    await this.prisma.cartItem.deleteMany({
      where: { cart_id: cart.id },
    });
    const refreshed = await this.fetchCartById(cart.id);
    return mapCartToResponse(refreshed);
  }

  async addItem(
    buyerId: string,
    dto: AddToCartDto,
  ): Promise<{ cart: CartResponse; isNew: boolean }> {
    if (!dto.product_id && !dto.rental_item_id) {
      throw new BadRequestException({
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: { product_id: ['Either product_id or rental_item_id must be provided'] },
      });
    }

    if (dto.product_id && dto.rental_item_id) {
      throw new BadRequestException({
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: { product_id: ['Cannot provide both product_id and rental_item_id'] },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({
        where: { buyer_id: buyerId },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: { buyer_id: buyerId },
        });
      }

      let isNew = false;

      if (dto.product_id) {
        const product = await tx.product.findUnique({
          where: { id: dto.product_id },
        });

        if (!product) {
          throw new NotFoundException({
            message: 'Product not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }

        const existingItem = await tx.cartItem.findFirst({
          where: {
            cart_id: cart.id,
            product_id: dto.product_id,
          },
        });

        const newQuantity = (existingItem ? existingItem.quantity : 0) + dto.quantity;

        if (newQuantity > product.stock) {
          throw new BadRequestException({
            message: 'Validation error or insufficient stock',
            code: 'VALIDATION_ERROR',
            details: { quantity: ['Insufficient product stock'] },
          });
        }

        if (existingItem) {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              price_snapshot: product.price,
            },
          });
        } else {
          isNew = true;
          await tx.cartItem.create({
            data: {
              cart_id: cart.id,
              product_id: product.id,
              quantity: dto.quantity,
              price_snapshot: product.price,
              item_type: CartItemType.product,
            },
          });
        }
      } else if (dto.rental_item_id) {
        const rental = await tx.rentalItem.findUnique({
          where: { id: dto.rental_item_id },
        });

        if (!rental) {
          throw new NotFoundException({
            message: 'Product not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }

        const existingRentalItem = await tx.cartItem.findFirst({
          where: {
            cart_id: cart.id,
            rental_item_id: dto.rental_item_id,
            duration_type: dto.duration_type ?? null,
          },
        });

        const newQuantity = (existingRentalItem ? existingRentalItem.quantity : 0) + dto.quantity;

        if (newQuantity > rental.available_units) {
          throw new BadRequestException({
            message: 'Validation error or insufficient stock',
            code: 'VALIDATION_ERROR',
            details: { quantity: ['Insufficient available units'] },
          });
        }

        let price = rental.price_per_day ?? rental.price_per_hour ?? rental.price_per_week ?? 0;
        if (dto.duration_type === RentalDurationType.hour && rental.price_per_hour != null) {
          price = rental.price_per_hour;
        } else if (dto.duration_type === RentalDurationType.day && rental.price_per_day != null) {
          price = rental.price_per_day;
        } else if (dto.duration_type === RentalDurationType.week && rental.price_per_week != null) {
          price = rental.price_per_week;
        }

        if (existingRentalItem) {
          await tx.cartItem.update({
            where: { id: existingRentalItem.id },
            data: {
              quantity: newQuantity,
              price_snapshot: price,
            },
          });
        } else {
          isNew = true;
          await tx.cartItem.create({
            data: {
              cart_id: cart.id,
              rental_item_id: rental.id,
              quantity: dto.quantity,
              price_snapshot: price,
              duration_type: dto.duration_type ?? null,
              item_type: CartItemType.rental,
            },
          });
        }
      }

      const refreshed = await tx.cart.findUnique({
        where: { id: cart.id },
        include: CART_INCLUDE,
      });

      return {
        cart: mapCartToResponse(refreshed as CartWithItems),
        isNew,
      };
    });
  }

  async updateItem(
    buyerId: string,
    productId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponse> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { buyer_id: buyerId },
        include: { items: true },
      });

      if (!cart) {
        throw new NotFoundException({
          message: 'Product or cart item not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      const item = cart.items.find(
        (i) => i.product_id === productId || i.rental_item_id === productId || i.id === productId,
      );

      if (!item) {
        throw new NotFoundException({
          message: 'Product or cart item not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      if (item.product_id) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id },
        });

        if (!product) {
          throw new NotFoundException({
            message: 'Product or cart item not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }

        if (dto.quantity > product.stock) {
          throw new BadRequestException({
            message: 'Validation error or insufficient stock',
            code: 'VALIDATION_ERROR',
            details: { quantity: ['Requested quantity exceeds available stock'] },
          });
        }

        await tx.cartItem.update({
          where: { id: item.id },
          data: {
            quantity: dto.quantity,
            price_snapshot: product.price,
          },
        });
      } else if (item.rental_item_id) {
        const rental = await tx.rentalItem.findUnique({
          where: { id: item.rental_item_id },
        });

        if (!rental) {
          throw new NotFoundException({
            message: 'Product or cart item not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }

        if (dto.quantity > rental.available_units) {
          throw new BadRequestException({
            message: 'Validation error or insufficient stock',
            code: 'VALIDATION_ERROR',
            details: { quantity: ['Requested quantity exceeds available units'] },
          });
        }

        await tx.cartItem.update({
          where: { id: item.id },
          data: {
            quantity: dto.quantity,
          },
        });
      }

      const refreshed = await tx.cart.findUnique({
        where: { id: cart.id },
        include: CART_INCLUDE,
      });

      return mapCartToResponse(refreshed as CartWithItems);
    });
  }

  async removeItem(buyerId: string, productId: string): Promise<CartResponse> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { buyer_id: buyerId },
        include: { items: true },
      });

      if (!cart) {
        throw new NotFoundException({
          message: 'Product or cart item not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      const item = cart.items.find(
        (i) => i.product_id === productId || i.rental_item_id === productId || i.id === productId,
      );

      if (!item) {
        throw new NotFoundException({
          message: 'Product or cart item not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      await tx.cartItem.delete({
        where: { id: item.id },
      });

      const refreshed = await tx.cart.findUnique({
        where: { id: cart.id },
        include: CART_INCLUDE,
      });

      return mapCartToResponse(refreshed as CartWithItems);
    });
  }
}
