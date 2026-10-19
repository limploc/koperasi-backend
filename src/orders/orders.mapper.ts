import { Order, OrderItem, OrderStatus, OrderType, RentalDurationType } from '@prisma/client';
import { mapProductToResponse, ProductResponse, ProductWithSeller } from '../products/products.mapper.js';

export interface OrderItemResponse {
  product_id: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  product: ProductResponse | null;
  rental_item_id: string | null;
  duration_type: RentalDurationType | null;
  item_type: string;
}

export interface OrderResponse {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: OrderStatus;
  items: OrderItemResponse[];
  created_at: string;
  updated_at: string;
  order_type: OrderType;
}

export type OrderItemWithRelations = OrderItem & {
  product?: ProductWithSeller | null;
};

export type OrderWithRelations = Order & {
  items: OrderItemWithRelations[];
};

export function mapOrderItemToResponse(item: OrderItemWithRelations): OrderItemResponse {
  return {
    product_id: item.product_id ?? null,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    product: item.product ? mapProductToResponse(item.product) : null,
    rental_item_id: item.rental_item_id ?? null,
    duration_type: item.duration_type ?? null,
    item_type: item.item_type,
  };
}

export function mapOrderToResponse(order: OrderWithRelations): OrderResponse {
  return {
    id: order.id,
    buyer_id: order.buyer_id,
    total_amount: order.total_amount,
    status: order.status,
    items: (order.items ?? []).map(mapOrderItemToResponse),
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    order_type: order.order_type,
  };
}
