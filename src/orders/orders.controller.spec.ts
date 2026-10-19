import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { OrderStatus, OrderType, UserRole } from '@prisma/client';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('OrdersController', () => {
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

  const req = {
    user: {
      sub: 'buyer-uuid-1',
      role: UserRole.BUYER,
      sid: 'session-id',
      type: 'access' as const,
    },
  };

  it('delegates checkout and returns 201 envelope', async () => {
    const ordersService = {
      checkout: vi.fn().mockResolvedValue(mockOrderResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(OrdersController);
    const result = await controller.checkout(req as never);

    expect(result).toEqual({
      success: true,
      message: 'Order created',
      data: mockOrderResponse,
    });
    expect(ordersService.checkout).toHaveBeenCalledWith('buyer-uuid-1');
  });

  it('delegates listOrders and returns envelope', async () => {
    const ordersService = {
      findAllBuyerOrders: vi.fn().mockResolvedValue({
        data: [mockOrderResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(OrdersController);
    const query = { page: 1, limit: 10 };
    const result = await controller.listOrders(query, req as never);

    expect(result).toEqual({
      success: true,
      message: 'Order history',
      data: {
        data: [mockOrderResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(ordersService.findAllBuyerOrders).toHaveBeenCalledWith('buyer-uuid-1', query);
  });

  it('delegates getOrderById and returns envelope', async () => {
    const ordersService = {
      findById: vi.fn().mockResolvedValue(mockOrderResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(OrdersController);
    const result = await controller.getOrderById('order-uuid-1', req as never);

    expect(result).toEqual({
      success: true,
      message: 'Order detail',
      data: mockOrderResponse,
    });
    expect(ordersService.findById).toHaveBeenCalledWith('order-uuid-1', {
      sub: 'buyer-uuid-1',
      role: UserRole.BUYER,
    });
  });

  it('delegates payOrder and returns envelope', async () => {
    const ordersService = {
      payOrder: vi.fn().mockResolvedValue({ ...mockOrderResponse, status: OrderStatus.paid }),
    };

    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(OrdersController);
    const dto = { simulate: 'success' as const };
    const result = await controller.payOrder('order-uuid-1', dto, req as never);

    expect(result).toEqual({
      success: true,
      message: 'Payment processed',
      data: { ...mockOrderResponse, status: OrderStatus.paid },
    });
    expect(ordersService.payOrder).toHaveBeenCalledWith(
      'order-uuid-1',
      { sub: 'buyer-uuid-1', role: UserRole.BUYER },
      dto,
    );
  });
});
