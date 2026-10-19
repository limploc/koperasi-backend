import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartItemType, OrderStatus, OrderType, ProductCategory, UserRole } from '@prisma/client';
import { AdminOrdersService } from './admin-orders.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;
  let prisma: PrismaService;

  const mockProduct = {
    id: 'product-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Kelapa Bulat',
    category: ProductCategory.kelapa,
    price: 15000,
    unit: 'kg',
    stock: 50,
    short_description: null,
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
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      rentalItem: {
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    } as unknown as PrismaService;

    service = new AdminOrdersService(prisma);
  });

  describe('findAll', () => {
    it('returns paginated orders for admin', async () => {
      (prisma.order.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.order.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockOrder]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when order not found', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.updateStatus('unknown', { status: OrderStatus.paid }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is already failed', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.failed,
      });

      await expect(
        service.updateStatus('order-uuid-1', { status: OrderStatus.paid }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates status and restores stock when transitioning to failed', async () => {
      (prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.failed });
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.order.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.updateStatus('order-uuid-1', { status: OrderStatus.failed });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { stock: { increment: 2 } },
      });
      expect(result.status).toBe(OrderStatus.failed);
    });
  });
});
