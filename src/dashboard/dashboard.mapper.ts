export interface DailySales {
  date: string;
  revenue: number;
  orders_count: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  total_sold: number;
  revenue: number;
}

export interface SellerDashboardResponse {
  total_revenue: number;
  total_orders: number;
  total_items_sold: number;
  average_order_value: number;
  sales_last_7_days: DailySales[];
  top_3_best_selling_products: TopProduct[];
}
