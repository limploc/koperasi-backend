import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CartItemType, OrderStatus, OrderType, ProductCategory, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockProduct = {
    id: 'product-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Kelapa Bulat',
    category: ProductCategory.kelapa,
    price: 15000,
    unit: 'kg',
    stock: 50,
    short_description: 'Kelapa segar',
    image_url: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    seller: {
      id: 'seller-uuid-1',
      email: 'seller@example.com',
      phone_number: '08123456789',
      role: UserRole.SELLER,
      created_at: new Date('2024-01-01T00:00:00Z'),
    },
  };

  const mockOrder = {
    id: 'order-uuid-1',
    buyer_id: 'buyer-uuid-1',
    total_amount: 30000,
    status: OrderStatus.pending,
    order_type: OrderType.PRODUCT_PURCHASE,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    items: [
      {
        id: 'order-item-1',
        order_id: 'order-uuid-1',
        product_id: 'product-uuid-1',
        rental_item_id: null,
        quantity: 2,
        price: 15000,
        price_snapshot: 15000,
        subtotal: 30000,
        duration_type: null,
        item_type: CartItemType.product,
        created_at: new Date('2024-01-01T00:00:00Z'),
        product: mockProduct,
        rental_item: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      cart: {
        findUnique: vi.fn(),
      },
      cartItem: {
        deleteMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      rentalItem: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    } as unknown as PrismaService;

    service = new OrdersService(prisma);
  });

  describe('checkout', () => {
    it('throws BadRequestException if cart is empty or not found', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.checkout('buyer-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if product stock is insufficient', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cart-1',
        buyer_id: 'buyer-uuid-1',
        items: [
          {
            product_id: 'product-uuid-1',
            quantity: 10,
          },
        ],
      });
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        stock: 5,
      });

      await expect(service.checkout('buyer-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('successfully creates order and decrements stock', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cart-1',
        buyer_id: 'buyer-uuid-1',
        items: [
          {
            product_id: 'product-uuid-1',
            quantity: 2,
          },
        ],
      });
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.order.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);
      (prisma.cartItem.deleteMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const result = await service.checkout('buyer-uuid-1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { stock: { decrement: 2 } },
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cart_id: 'cart-1' } });
      expect(result.id).toBe('order-uuid-1');
      expect(result.status).toBe(OrderStatus.pending);
    });
  });

  describe('findAllBuyerOrders', () => {
    it('returns paginated orders for buyer', async () => {
      (prisma.order.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.order.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockOrder]);

      const result = await service.findAllBuyerOrders('buyer-uuid-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when order does not exist', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.findById('non-existent', { sub: 'buyer-uuid-1', role: UserRole.BUYER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when buyer does not own the order', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      await expect(
        service.findById('order-uuid-1', { sub: 'different-buyer', role: UserRole.BUYER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns order when requested by owner', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      const result = await service.findById('order-uuid-1', { sub: 'buyer-uuid-1', role: UserRole.BUYER });

      expect(result.id).toBe('order-uuid-1');
    });

    it('returns order when requested by SUPERADMIN', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      const result = await service.findById('order-uuid-1', { sub: 'admin-uuid', role: UserRole.SUPERADMIN });

      expect(result.id).toBe('order-uuid-1');
    });
  });

  describe('payOrder', () => {
    it('throws NotFoundException when order not found', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.payOrder('unknown', { sub: 'buyer-uuid-1', role: UserRole.BUYER }, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is not pending', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.paid,
      });

      await expect(
        service.payOrder('order-uuid-1', { sub: 'buyer-uuid-1', role: UserRole.BUYER }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks order as paid on success', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.paid });
      (prisma.order.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.payOrder(
        'order-uuid-1',
        { sub: 'buyer-uuid-1', role: UserRole.BUYER },
        { simulate: 'success' },
      );

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { status: OrderStatus.paid },
      });
      expect(result.status).toBe(OrderStatus.paid);
    });

    it('marks order as failed and restores stock on failure', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.failed });
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.order.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.payOrder(
        'order-uuid-1',
        { sub: 'buyer-uuid-1', role: UserRole.BUYER },
        { simulate: 'failure' },
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { stock: { increment: 2 } },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { status: OrderStatus.failed },
      });
      expect(result.status).toBe(OrderStatus.failed);
    });
  });

  describe('adminFindAllOrders', () => {
    it('returns paginated orders for admin', async () => {
      (prisma.order.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.order.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockOrder]);

      const result = await service.adminFindAllOrders({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('adminUpdateStatus', () => {
    it('throws NotFoundException if order does not exist', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.adminUpdateStatus('non-existent', { status: OrderStatus.paid }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if order is already failed', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.failed,
      });

      await expect(
        service.adminUpdateStatus('order-uuid-1', { status: OrderStatus.paid }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates status and restores stock if transitioning to failed', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.failed });
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.order.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.adminUpdateStatus('order-uuid-1', { status: OrderStatus.failed });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { stock: { increment: 2 } },
      });
      expect(result.status).toBe(OrderStatus.failed);
    });
  });
});
