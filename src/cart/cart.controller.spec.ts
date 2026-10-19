import { describe, it, expect, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CartItemType, ProductCategory, UserRole } from '@prisma/client';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('CartController', () => {
  const mockCartResponse = {
    id: 'cart-uuid-1',
    buyer_id: 'buyer-uuid-1',
    items: [
      {
        product_id: 'product-uuid-1',
        quantity: 2,
        price_snapshot: 15000,
        subtotal: 30000,
        rental_item_id: null,
        duration_type: null,
        item_type: CartItemType.product,
        product: {
          id: 'product-uuid-1',
          seller_id: 'seller-uuid-1',
          name: 'Kelapa Bulat',
          category: ProductCategory.kelapa,
          price: 15000,
          unit: 'kg',
          stock: 50,
          short_description: null,
          image_url: null,
          seller: null,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      },
    ],
    total_amount: 30000,
    total_items: 1,
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

  it('delegates getCart and returns standard envelope', async () => {
    const cartService = {
      getCart: vi.fn().mockResolvedValue(mockCartResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);
    const result = await controller.getCart(req as never);

    expect(result).toEqual({
      success: true,
      message: 'Current cart',
      data: mockCartResponse,
    });
    expect(cartService.getCart).toHaveBeenCalledWith('buyer-uuid-1');
  });

  it('delegates clearCart and returns standard envelope', async () => {
    const emptyCart = { ...mockCartResponse, items: [], total_amount: 0, total_items: 0 };
    const cartService = {
      clearCart: vi.fn().mockResolvedValue(emptyCart),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);
    const result = await controller.clearCart(req as never);

    expect(result).toEqual({
      success: true,
      message: 'Cart cleared',
      data: emptyCart,
    });
    expect(cartService.clearCart).toHaveBeenCalledWith('buyer-uuid-1');
  });

  it('delegates addCartItem and returns 201 when new item created', async () => {
    const cartService = {
      addItem: vi.fn().mockResolvedValue({ cart: mockCartResponse, isNew: true }),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);
    const res = { status: vi.fn() };
    const dto = { product_id: 'product-uuid-1', quantity: 2 };

    const result = await controller.addCartItem(dto, req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(result).toEqual({
      success: true,
      message: 'Item added to cart (created)',
      data: mockCartResponse,
    });
    expect(cartService.addItem).toHaveBeenCalledWith('buyer-uuid-1', dto);
  });

  it('delegates addCartItem and returns 200 when existing item updated', async () => {
    const cartService = {
      addItem: vi.fn().mockResolvedValue({ cart: mockCartResponse, isNew: false }),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);
    const res = { status: vi.fn() };
    const dto = { product_id: 'product-uuid-1', quantity: 1 };

    const result = await controller.addCartItem(dto, req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(result).toEqual({
      success: true,
      message: 'Item added to cart',
      data: mockCartResponse,
    });
  });

  it('delegates updateCartItem and returns envelope', async () => {
    const cartService = {
      updateItem: vi.fn().mockResolvedValue(mockCartResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);
    const dto = { quantity: 3 };

    const result = await controller.updateCartItem('product-uuid-1', dto, req as never);

    expect(result).toEqual({
      success: true,
      message: 'Cart item updated',
      data: mockCartResponse,
    });
    expect(cartService.updateItem).toHaveBeenCalledWith('buyer-uuid-1', 'product-uuid-1', dto);
  });

  it('delegates removeCartItem and returns envelope', async () => {
    const emptyCart = { ...mockCartResponse, items: [], total_amount: 0, total_items: 0 };
    const cartService = {
      removeItem: vi.fn().mockResolvedValue(emptyCart),
    };

    const module = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: cartService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(CartController);

    const result = await controller.removeCartItem('product-uuid-1', req as never);

    expect(result).toEqual({
      success: true,
      message: 'Item removed',
      data: emptyCart,
    });
    expect(cartService.removeItem).toHaveBeenCalledWith('buyer-uuid-1', 'product-uuid-1');
  });
});
