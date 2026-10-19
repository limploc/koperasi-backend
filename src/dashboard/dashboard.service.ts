import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { SellerDashboardResponse } from './dashboard.mapper.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSellerDashboard(
    sellerId: string,
    referenceDate: Date = new Date(),
  ): Promise<SellerDashboardResponse> {
    const orderItems = await this.prisma.orderItem.findMany({
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

    let totalRevenue = 0;
    let totalItemsSold = 0;
    const distinctOrderIds = new Set<string>();
    const dayOrders = new Map<string, Set<string>>();
    const dayRevenue = new Map<string, number>();
    const productStats = new Map<
      string,
      { product_id: string; name: string; total_sold: number; revenue: number }
    >();

    for (const item of orderItems) {
      totalRevenue += item.subtotal;
      totalItemsSold += item.quantity;
      distinctOrderIds.add(item.order_id);

      const itemDate = (item.order?.created_at ?? item.created_at)
        .toISOString()
        .slice(0, 10);

      if (!dayOrders.has(itemDate)) {
        dayOrders.set(itemDate, new Set());
        dayRevenue.set(itemDate, 0);
      }
      dayOrders.get(itemDate)!.add(item.order_id);
      dayRevenue.set(itemDate, (dayRevenue.get(itemDate) ?? 0) + item.subtotal);

      if (item.product_id && item.product) {
        const existing = productStats.get(item.product_id);
        if (existing) {
          existing.total_sold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          productStats.set(item.product_id, {
            product_id: item.product_id,
            name: item.product.name,
            total_sold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }

    const totalOrders = distinctOrderIds.size;
    const averageOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Generate last 7 days ending on referenceDate
    const salesLast7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setUTCDate(referenceDate.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      salesLast7Days.push({
        date: dateStr,
        revenue: dayRevenue.get(dateStr) ?? 0,
        orders_count: dayOrders.get(dateStr)?.size ?? 0,
      });
    }

    const top3BestSellingProducts = Array.from(productStats.values())
      .sort((a, b) => b.total_sold - a.total_sold || b.revenue - a.revenue)
      .slice(0, 3);

    return {
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      total_items_sold: totalItemsSold,
      average_order_value: averageOrderValue,
      sales_last_7_days: salesLast7Days,
      top_3_best_selling_products: top3BestSellingProducts,
    };
  }
}
