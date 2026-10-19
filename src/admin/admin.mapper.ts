import {
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  RentalDurationType,
  User,
  UserRole,
} from '@prisma/client';
import {
  mapProductToResponse,
  ProductResponse,
  ProductWithSeller,
} from '../products/products.mapper.js';

export interface UserResponse {
  id: string;
  email: string;
  phone_number: string;
  role: UserRole;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapUserToResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    phone_number: user.phone_number,
    role: user.role,
    name: user.name ?? null,
    is_active: user.is_active,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}

export interface AdminOrderItemResponse {
  product_id: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  product: ProductResponse | null;
  rental_item_id: string | null;
  duration_type: RentalDurationType | null;
  item_type: string;
}

export interface AdminOrderResponse {
  id: string;
  buyer_id: string;
  total_amount: number;
  status: OrderStatus;
  items: AdminOrderItemResponse[];
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

export function mapAdminOrderItemToResponse(item: OrderItemWithRelations): AdminOrderItemResponse {
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

export function mapAdminOrderToResponse(order: OrderWithRelations): AdminOrderResponse {
  return {
    id: order.id,
    buyer_id: order.buyer_id,
    total_amount: order.total_amount,
    status: order.status,
    items: (order.items ?? []).map(mapAdminOrderItemToResponse),
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    order_type: order.order_type,
  };
}
