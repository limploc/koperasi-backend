import { PricingType, RentalItem } from '@prisma/client';
import { PaginationMetaResponse } from '../products/products.mapper.js';

export interface RentalItemResponse {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  images: string[] | null;
  available_units: number;
  pricing_type: PricingType;
  price_per_hour: number | null;
  price_per_day: number | null;
  price_per_week: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedRentalItemsResponse {
  data: RentalItemResponse[];
  meta: PaginationMetaResponse;
}

export function mapRentalItemToResponse(item: RentalItem): RentalItemResponse {
  return {
    id: item.id,
    seller_id: item.seller_id,
    name: item.name,
    description: item.description ?? null,
    images: Array.isArray(item.images) ? (item.images as string[]) : null,
    available_units: item.available_units,
    pricing_type: item.pricing_type,
    price_per_hour: item.price_per_hour ?? null,
    price_per_day: item.price_per_day ?? null,
    price_per_week: item.price_per_week ?? null,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}
