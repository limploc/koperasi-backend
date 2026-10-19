import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    orderItem: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sellerId = 'seller-uuid-1';
  const referenceDate = new Date('2024-01-07T12:00:00.000Z');

  beforeEach(() => {
    prisma = {
      orderItem: {
        findMany: vi.fn(),
      },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('handles empty dataset with default zero values and 7-day array', async () => {
    prisma.orderItem.findMany.mockResolvedValue([]);

    const result = await service.getSellerDashboard(sellerId, referenceDate);

    expect(result).toEqual({
      total_revenue: 0,
      total_orders: 0,
      total_items_sold: 0,
      average_order_value: 0,
      sales_last_7_days: [
        { date: '2024-01-01', revenue: 0, orders_count: 0 },
        { date: '2024-01-02', revenue: 0, orders_count: 0 },
        { date: '2024-01-03', revenue: 0, orders_count: 0 },
        { date: '2024-01-04', revenue: 0, orders_count: 0 },
        { date: '2024-01-05', revenue: 0, orders_count: 0 },
        { date: '2024-01-06', revenue: 0, orders_count: 0 },
        { date: '2024-01-07', revenue: 0, orders_count: 0 },
      ],
      top_3_best_selling_products: [],
    });

    expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
      where: {
        order: {
          status: OrderStatus.paid,
        },
        OR: [
          { product: { seller_id: sellerId } },
          { rental_item: { seller_id: sellerId } },
        ],
      },
      select: {
        order_id: true,
        product_id: true,
        quantity: true,
        subtotal: true,
        created_at: true,
        order: {
          select: {
            created_at: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  it('aggregates metrics correctly from multiple paid items across orders', async () => {
    const mockItems = [
      {
        order_id: 'order-1',
        product_id: 'prod-1',
        quantity: 2,
        subtotal: 100000,
        created_at: new Date('2024-01-05T10:00:00.000Z'),
        order: { created_at: new Date('2024-01-05T10:00:00.000Z') },
        product: { id: 'prod-1', name: 'Product A' },
      },
      {
        order_id: 'order-1',
        product_id: 'prod-2',
        quantity: 1,
        subtotal: 50000,
        created_at: new Date('2024-01-05T10:00:00.000Z'),
        order: { created_at: new Date('2024-01-05T10:00:00.000Z') },
        product: { id: 'prod-2', name: 'Product B' },
      },
      {
        order_id: 'order-2',
        product_id: 'prod-1',
        quantity: 3,
        subtotal: 150000,
        created_at: new Date('2024-01-06T15:00:00.000Z'),
        order: { created_at: new Date('2024-01-06T15:00:00.000Z') },
        product: { id: 'prod-1', name: 'Product A' },
      },
      {
        order_id: 'order-3',
        product_id: null,
        rental_item_id: 'rental-1',
        quantity: 1,
        subtotal: 200000,
        created_at: new Date('2024-01-07T08:00:00.000Z'),
        order: { created_at: new Date('2024-01-07T08:00:00.000Z') },
        product: null,
      },
    ];

    prisma.orderItem.findMany.mockResolvedValue(mockItems);

    const result = await service.getSellerDashboard(sellerId, referenceDate);

    // Total revenue: 100000 + 50000 + 150000 + 200000 = 500000
    expect(result.total_revenue).toBe(500000);
    // Total orders: 3 distinct orders (order-1, order-2, order-3)
    expect(result.total_orders).toBe(3);
    // Total items sold: 2 + 1 + 3 + 1 = 7
    expect(result.total_items_sold).toBe(7);
    // Average order value: Math.round(500000 / 3) = 166667
    expect(result.average_order_value).toBe(166667);

    // Sales last 7 days check
    const day5 = result.sales_last_7_days.find((d) => d.date === '2024-01-05');
    expect(day5).toEqual({ date: '2024-01-05', revenue: 150000, orders_count: 1 });

    const day6 = result.sales_last_7_days.find((d) => d.date === '2024-01-06');
    expect(day6).toEqual({ date: '2024-01-06', revenue: 150000, orders_count: 1 });

    const day7 = result.sales_last_7_days.find((d) => d.date === '2024-01-07');
    expect(day7).toEqual({ date: '2024-01-07', revenue: 200000, orders_count: 1 });

    const day1 = result.sales_last_7_days.find((d) => d.date === '2024-01-01');
    expect(day1).toEqual({ date: '2024-01-01', revenue: 0, orders_count: 0 });

    // Top products (only Product A and Product B, sorted by total_sold desc)
    expect(result.top_3_best_selling_products).toEqual([
      {
        product_id: 'prod-1',
        name: 'Product A',
        total_sold: 5,
        revenue: 250000,
      },
      {
        product_id: 'prod-2',
        name: 'Product B',
        total_sold: 1,
        revenue: 50000,
      },
    ]);
  });

  it('limits top products to max 3 items', async () => {
    const mockItems = [
      {
        order_id: 'order-1',
        product_id: 'p1',
        quantity: 10,
        subtotal: 100,
        created_at: referenceDate,
        order: { created_at: referenceDate },
        product: { id: 'p1', name: 'Product 1' },
      },
      {
        order_id: 'order-2',
        product_id: 'p2',
        quantity: 8,
        subtotal: 80,
        created_at: referenceDate,
        order: { created_at: referenceDate },
        product: { id: 'p2', name: 'Product 2' },
      },
      {
        order_id: 'order-3',
        product_id: 'p3',
        quantity: 6,
        subtotal: 60,
        created_at: referenceDate,
        order: { created_at: referenceDate },
        product: { id: 'p3', name: 'Product 3' },
      },
      {
        order_id: 'order-4',
        product_id: 'p4',
        quantity: 4,
        subtotal: 40,
        created_at: referenceDate,
        order: { created_at: referenceDate },
        product: { id: 'p4', name: 'Product 4' },
      },
    ];

    prisma.orderItem.findMany.mockResolvedValue(mockItems);

    const result = await service.getSellerDashboard(sellerId, referenceDate);

    expect(result.top_3_best_selling_products).toHaveLength(3);
    expect(result.top_3_best_selling_products[0].product_id).toBe('p1');
    expect(result.top_3_best_selling_products[1].product_id).toBe('p2');
    expect(result.top_3_best_selling_products[2].product_id).toBe('p3');
  });
});
