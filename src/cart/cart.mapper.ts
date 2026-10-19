import { Cart, CartItem, CartItemType, RentalDurationType } from '@prisma/client';
import { mapProductToResponse, ProductResponse, ProductWithSeller } from '../products/products.mapper.js';

export interface CartItemResponse {
  product_id: string | null;
  quantity: number;
  price_snapshot: number;
  product: ProductResponse | null;
  subtotal: number;
  rental_item_id: string | null;
  duration_type: RentalDurationType | null;
  item_type: CartItemType;
}

export interface CartResponse {
  id: string;
  buyer_id: string;
  items: CartItemResponse[];
  total_amount: number;
  total_items: number;
  created_at: string;
  updated_at: string;
}

export type CartItemWithRelations = CartItem & {
  product?: ProductWithSeller | null;
};

export type CartWithItems = Cart & {
  items: CartItemWithRelations[];
};

export function mapCartItemToResponse(item: CartItemWithRelations): CartItemResponse {
  return {
    product_id: item.product_id ?? null,
    quantity: item.quantity,
    price_snapshot: item.price_snapshot,
    product: item.product ? mapProductToResponse(item.product) : null,
    subtotal: item.quantity * item.price_snapshot,
    rental_item_id: item.rental_item_id ?? null,
    duration_type: item.duration_type ?? null,
    item_type: item.item_type,
  };
}

export function mapCartToResponse(cart: CartWithItems): CartResponse {
  const items = (cart.items ?? []).map(mapCartItemToResponse);
  const total_amount = items.reduce((acc, item) => acc + item.subtotal, 0);
  const total_items = items.length;

  return {
    id: cart.id,
    buyer_id: cart.buyer_id,
    items,
    total_amount,
    total_items,
    created_at: cart.created_at.toISOString(),
    updated_at: cart.updated_at.toISOString(),
  };
}
