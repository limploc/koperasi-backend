import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartItemType, ProductCategory, UserRole } from '@prisma/client';
import { CartService } from './cart.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('CartService', () => {
  let service: CartService;
  let prisma: PrismaService;

  const mockProduct = {
    id: 'product-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Kelapa Bulat',
    category: ProductCategory.kelapa,
    price: 15000,
    unit: 'kg',
    stock: 50,
    short_description: 'Kelapa segar',
    image_url: 'https://example.com/img.jpg',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    seller: {
      id: 'seller-uuid-1',
      email: 'seller@example.com',
      phone_number: '08123456789',
      role: UserRole.SELLER,
      created_at: new Date('2024-01-01T00:00:00Z'),
    },
  };

  const mockCart = {
    id: 'cart-uuid-1',
    buyer_id: 'buyer-uuid-1',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    items: [
      {
        id: 'cart-item-1',
        cart_id: 'cart-uuid-1',
        product_id: 'product-uuid-1',
        rental_item_id: null,
        quantity: 2,
        price_snapshot: 15000,
        duration_type: null,
        item_type: CartItemType.product,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        product: mockProduct,
        rental_item: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      cart: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      cartItem: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
      },
      rentalItem: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    } as unknown as PrismaService;

    service = new CartService(prisma);
  });

  describe('getCart', () => {
    it('returns existing cart for buyer', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart);

      const result = await service.getCart('buyer-uuid-1');

      expect(result.id).toBe('cart-uuid-1');
      expect(result.buyer_id).toBe('buyer-uuid-1');
      expect(result.items).toHaveLength(1);
      expect(result.total_amount).toBe(30000);
      expect(result.total_items).toBe(1);
    });

    it('creates new cart if none exists for buyer', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.cart.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new-cart-uuid',
        buyer_id: 'buyer-uuid-2',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        items: [],
      });

      const result = await service.getCart('buyer-uuid-2');

      expect(result.id).toBe('new-cart-uuid');
      expect(result.items).toEqual([]);
      expect(result.total_amount).toBe(0);
      expect(result.total_items).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('deletes all items and returns empty cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce({ ...mockCart, items: [] });
      (prisma.cartItem.deleteMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const result = await service.clearCart('buyer-uuid-1');

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cart_id: 'cart-uuid-1' } });
      expect(result.items).toHaveLength(0);
      expect(result.total_amount).toBe(0);
    });
  });

  describe('addItem', () => {
    it('throws BadRequestException when neither product_id nor rental_item_id is provided', async () => {
      await expect(service.addItem('buyer-uuid-1', { quantity: 1 })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when both product_id and rental_item_id are provided', async () => {
      await expect(
        service.addItem('buyer-uuid-1', {
          product_id: 'product-uuid-1',
          rental_item_id: 'rental-uuid-1',
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart);
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.addItem('buyer-uuid-1', {
          product_id: 'non-existent',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when requested quantity exceeds product stock', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart);
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        stock: 5,
      });
      (prisma.cartItem.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.addItem('buyer-uuid-1', {
          product_id: 'product-uuid-1',
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('adds new product item to cart when not already present', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'cart-uuid-1', buyer_id: 'buyer-uuid-1' })
        .mockResolvedValueOnce(mockCart);
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.cartItem.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.cartItem.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.addItem('buyer-uuid-1', {
        product_id: 'product-uuid-1',
        quantity: 2,
      });

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          cart_id: 'cart-uuid-1',
          product_id: 'product-uuid-1',
          quantity: 2,
          price_snapshot: 15000,
          item_type: CartItemType.product,
        },
      });
      expect(result.isNew).toBe(true);
      expect(result.cart.total_amount).toBe(30000);
    });

    it('updates quantity of existing product item in cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'cart-uuid-1', buyer_id: 'buyer-uuid-1' })
        .mockResolvedValueOnce({
          ...mockCart,
          items: [{ ...mockCart.items[0], quantity: 5 }],
        });
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.cartItem.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart.items[0]);
      (prisma.cartItem.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.addItem('buyer-uuid-1', {
        product_id: 'product-uuid-1',
        quantity: 3,
      });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-1' },
        data: {
          quantity: 5,
          price_snapshot: 15000,
        },
      });
      expect(result.isNew).toBe(false);
    });
  });

  describe('updateItem', () => {
    it('throws NotFoundException when cart does not exist', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.updateItem('buyer-uuid-1', 'product-uuid-1', { quantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when item is not in cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCart,
        items: [],
      });

      await expect(
        service.updateItem('buyer-uuid-1', 'non-existent-product', { quantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when quantity exceeds stock', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart);
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        stock: 3,
      });

      await expect(
        service.updateItem('buyer-uuid-1', 'product-uuid-1', { quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates quantity and returns updated cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce({
          ...mockCart,
          items: [{ ...mockCart.items[0], quantity: 4 }],
        });
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.cartItem.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.updateItem('buyer-uuid-1', 'product-uuid-1', { quantity: 4 });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-1' },
        data: {
          quantity: 4,
          price_snapshot: 15000,
        },
      });
      expect(result.items[0].quantity).toBe(4);
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when item is not in cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCart);

      await expect(service.removeItem('buyer-uuid-1', 'unknown-item')).rejects.toThrow(NotFoundException);
    });

    it('deletes item and returns updated cart', async () => {
      (prisma.cart.findUnique as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValueOnce({
          ...mockCart,
          items: [],
        });
      (prisma.cartItem.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.removeItem('buyer-uuid-1', 'product-uuid-1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'cart-item-1' } });
      expect(result.items).toHaveLength(0);
    });
  });
});
