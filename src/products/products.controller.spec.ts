import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ProductCategory, UserRole } from '@prisma/client';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('ProductsController', () => {
  const mockProductResponse = {
    id: 'product-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Kelapa Bulat Segar',
    category: ProductCategory.kelapa,
    price: 15000,
    unit: 'kg',
    stock: 100,
    short_description: 'Kelapa segar kualitas premium',
    image_url: 'https://example.com/kelapa.jpg',
    seller: {
      id: 'seller-uuid-1',
      email: 'seller@example.test',
      phone_number: '081234567890',
      role: UserRole.SELLER,
      created_at: '2024-01-01T00:00:00.000Z',
    },
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  it('delegates listProducts and returns envelope', async () => {
    const productsService = {
      findAll: vi.fn().mockResolvedValue({
        data: [mockProductResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ProductsController);
    const query = { page: 1, limit: 10, sortBy: 'created_at' as const, sortOrder: 'desc' as const };

    const result = await controller.listProducts(query);

    expect(result).toEqual({
      success: true,
      message: 'List of products',
      data: {
        data: [mockProductResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(productsService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates createProduct and returns 201 envelope', async () => {
    const productsService = {
      create: vi.fn().mockResolvedValue(mockProductResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ProductsController);
    const dto = {
      name: 'Kelapa Bulat Segar',
      category: ProductCategory.kelapa,
      price: 15000,
      unit: 'kg',
      stock: 100,
    };
    const req = { user: { sub: 'seller-uuid-1', role: UserRole.SELLER, sid: 'sess', type: 'access' as const } };

    const result = await controller.createProduct(dto, req as never);

    expect(result).toEqual({
      success: true,
      message: 'Product created',
      data: mockProductResponse,
    });
    expect(productsService.create).toHaveBeenCalledWith(dto, 'seller-uuid-1');
  });

  it('delegates getProductById and returns envelope', async () => {
    const productsService = {
      findById: vi.fn().mockResolvedValue(mockProductResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ProductsController);
    const result = await controller.getProductById('product-uuid-1');

    expect(result).toEqual({
      success: true,
      message: 'Product detail',
      data: mockProductResponse,
    });
    expect(productsService.findById).toHaveBeenCalledWith('product-uuid-1');
  });

  it('delegates updateProduct and returns envelope', async () => {
    const productsService = {
      update: vi.fn().mockResolvedValue({ ...mockProductResponse, price: 18000 }),
    };

    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ProductsController);
    const dto = { price: 18000 };
    const req = { user: { sub: 'seller-uuid-1', role: UserRole.SELLER, sid: 'sess', type: 'access' as const } };

    const result = await controller.updateProduct('product-uuid-1', dto, req as never);

    expect(result).toEqual({
      success: true,
      message: 'Product updated',
      data: { ...mockProductResponse, price: 18000 },
    });
    expect(productsService.update).toHaveBeenCalledWith('product-uuid-1', dto, {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
    });
  });

  it('delegates deleteProduct and returns envelope', async () => {
    const productsService = {
      delete: vi.fn().mockResolvedValue({ message: 'Product deleted successfully' }),
    };

    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(ProductsController);
    const req = { user: { sub: 'seller-uuid-1', role: UserRole.SELLER, sid: 'sess', type: 'access' as const } };

    const result = await controller.deleteProduct('product-uuid-1', req as never);

    expect(result).toEqual({
      success: true,
      message: 'Product deleted',
      data: { message: 'Product deleted successfully' },
    });
    expect(productsService.delete).toHaveBeenCalledWith('product-uuid-1', {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
    });
  });
});
