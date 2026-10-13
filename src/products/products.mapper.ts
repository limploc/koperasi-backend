import { Product, ProductCategory, User, UserRole } from '@prisma/client';

export interface ProductSellerResponse {
  id: string;
  email: string;
  phone_number: string;
  role: UserRole;
  created_at: string;
}

export interface ProductResponse {
  id: string;
  seller_id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  stock: number;
  short_description: string | null;
  image_url: string | null;
  seller: ProductSellerResponse | null;
  created_at: string;
  updated_at: string;
}

export interface PaginationMetaResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ProductWithSeller = Product & {
  seller?: Pick<User, 'id' | 'email' | 'phone_number' | 'role' | 'created_at'> | null;
};

export function mapProductToResponse(product: ProductWithSeller): ProductResponse {
  return {
    id: product.id,
    seller_id: product.seller_id,
    name: product.name,
    category: product.category,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    short_description: product.short_description ?? null,
    image_url: product.image_url ?? null,
    seller: product.seller
      ? {
          id: product.seller.id,
          email: product.seller.email,
          phone_number: product.seller.phone_number,
          role: product.seller.role,
          created_at: product.seller.created_at.toISOString(),
        }
      : null,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  };
}
