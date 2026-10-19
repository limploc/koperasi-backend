import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('DashboardController', () => {
  const mockDashboardData = {
    total_revenue: 5000000,
    total_orders: 30,
    total_items_sold: 120,
    average_order_value: 166667,
    sales_last_7_days: [
      {
        date: '2024-01-01',
        revenue: 450000,
        orders_count: 3,
      },
    ],
    top_3_best_selling_products: [
      {
        product_id: 'prod-uuid-1',
        name: 'Kelapa Bulat Segar',
        total_sold: 50,
        revenue: 750000,
      },
    ],
  };

  const sellerReq = {
    user: {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
      sid: 'session-id',
      type: 'access' as const,
    },
  };

  it('delegates getSellerDashboard and returns standard envelope', async () => {
    const dashboardService = {
      getSellerDashboard: vi.fn().mockResolvedValue(mockDashboardData),
    };

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(DashboardController);
    const result = await controller.getSellerDashboard(sellerReq as never);

    expect(result).toEqual({
      success: true,
      message: 'Dashboard analytics',
      data: mockDashboardData,
    });
    expect(dashboardService.getSellerDashboard).toHaveBeenCalledWith('seller-uuid-1');
  });
});
