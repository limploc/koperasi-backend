import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { OrderStatus, OrderType } from '@prisma/client';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('AdminOrdersController', () => {
  const mockOrderResponse = {
    id: 'order-uuid-1',
    buyer_id: 'buyer-uuid-1',
    total_amount: 30000,
    status: OrderStatus.pending,
    order_type: OrderType.PRODUCT_PURCHASE,
    items: [],
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  it('delegates adminListOrders and returns envelope', async () => {
    const ordersService = {
      adminFindAllOrders: vi.fn().mockResolvedValue({
        data: [mockOrderResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminOrdersController);
    const query = { page: 1, limit: 10 };
    const result = await controller.adminListOrders(query);

    expect(result).toEqual({
      success: true,
      message: 'All orders',
      data: {
        data: [mockOrderResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(ordersService.adminFindAllOrders).toHaveBeenCalledWith(query);
  });

  it('delegates adminUpdateOrderStatus and returns envelope', async () => {
    const ordersService = {
      adminUpdateStatus: vi.fn().mockResolvedValue({
        ...mockOrderResponse,
        status: OrderStatus.paid,
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminOrdersController);
    const dto = { status: OrderStatus.paid };
    const result = await controller.adminUpdateOrderStatus('order-uuid-1', dto);

    expect(result).toEqual({
      success: true,
      message: 'Order status updated',
      data: {
        ...mockOrderResponse,
        status: OrderStatus.paid,
      },
    });
    expect(ordersService.adminUpdateStatus).toHaveBeenCalledWith('order-uuid-1', dto);
  });
});
