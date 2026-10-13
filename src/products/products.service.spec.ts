import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProductCategory, UserRole } from '@prisma/client';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let cloudinary: CloudinaryService;

  const mockSeller = {
    id: 'seller-uuid-1',
    email: 'seller@example.test',
    phone_number: '081234567890',
    role: UserRole.SELLER,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
  };

  const mockProduct = {
    id: 'product-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Kelapa Bulat Segar',
    category: ProductCategory.kelapa,
    price: 15000,
    unit: 'kg',
    stock: 100,
    short_description: 'Kelapa segar kualitas premium',
    image_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/kelapa.jpg',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    seller: mockSeller,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      product: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    } as unknown as PrismaService;

    cloudinary = {
      deleteImage: vi.fn().mockResolvedValue(true),
      extractPublicIdFromUrl: vi.fn().mockReturnValue('products/kelapa'),
      isCloudinaryUrl: vi.fn().mockReturnValue(true),
    } as unknown as CloudinaryService;

    service = new ProductsService(prisma, cloudinary);
  });

  describe('findAll', () => {
    it('returns paginated products with default settings', async () => {
      (prisma.product.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.product.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockProduct]);

      const result = await service.findAll({ page: 1, limit: 10, sortBy: 'created_at', sortOrder: 'desc' });

      expect(prisma.product.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        include: {
          seller: {
            select: {
              id: true,
              email: true,
              phone_number: true,
              role: true,
              created_at: true,
            },
          },
        },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('product-uuid-1');
      expect(result.data[0].seller?.email).toBe('seller@example.test');
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('filters by category and searches by name', async () => {
      (prisma.product.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.product.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        category: ProductCategory.jagung,
        search: 'jagung manis',
        sortBy: 'price',
        sortOrder: 'asc',
      });

      expect(prisma.product.count).toHaveBeenCalledWith({
        where: {
          category: ProductCategory.jagung,
          name: { contains: 'jagung manis', mode: 'insensitive' },
        },
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: ProductCategory.jagung,
            name: { contains: 'jagung manis', mode: 'insensitive' },
          },
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findById', () => {
    it('returns product details when found', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      const result = await service.findById('product-uuid-1');

      expect(result.id).toBe('product-uuid-1');
      expect(result.name).toBe('Kelapa Bulat Segar');
      expect(result.seller?.id).toBe('seller-uuid-1');
    });

    it('throws NotFoundException when product is not found', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.findById('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates product successfully for active seller', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'seller-uuid-1',
        role: UserRole.SELLER,
        is_active: true,
      });
      (prisma.product.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      const dto = {
        name: 'Kelapa Bulat Segar',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: 100,
        short_description: 'Kelapa segar kualitas premium',
        image_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/kelapa.jpg',
      };

      const result = await service.create(dto, 'seller-uuid-1');

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          category: dto.category,
          price: dto.price,
          unit: dto.unit,
          stock: dto.stock,
          short_description: dto.short_description,
          image_url: dto.image_url,
          seller_id: 'seller-uuid-1',
        },
        include: {
          seller: {
            select: {
              id: true,
              email: true,
              phone_number: true,
              role: true,
              created_at: true,
            },
          },
        },
      });
      expect(result.id).toBe('product-uuid-1');
    });

    it('rejects creation if seller does not exist or is inactive', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Kelapa',
            category: ProductCategory.kelapa,
            price: 10000,
            unit: 'kg',
            stock: 10,
          },
          'invalid-seller',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update', () => {
    it('updates product when requested by the owner SELLER', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        price: 18000,
      });

      const result = await service.update(
        'product-uuid-1',
        { price: 18000 },
        { sub: 'seller-uuid-1', role: UserRole.SELLER },
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { price: 18000 },
        include: expect.any(Object),
      });
      expect(result.price).toBe(18000);
    });

    it('allows SUPERADMIN to update any product', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });

      const result = await service.update(
        'product-uuid-1',
        { stock: 50 },
        { sub: 'admin-uuid-99', role: UserRole.SUPERADMIN },
      );

      expect(result.stock).toBe(50);
    });

    it('rejects update if caller is another SELLER (ownership violation)', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      await expect(
        service.update(
          'product-uuid-1',
          { price: 20000 },
          { sub: 'different-seller-uuid', role: UserRole.SELLER },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if product to update does not exist', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.update(
          'non-existent',
          { price: 20000 },
          { sub: 'seller-uuid-1', role: UserRole.SELLER },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('cleans up old Cloudinary asset when image is replaced', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockProduct,
        image_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/new-image.jpg',
      });

      await service.update(
        'product-uuid-1',
        { image_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/new-image.jpg' },
        { sub: 'seller-uuid-1', role: UserRole.SELLER },
      );

      expect(cloudinary.deleteImage).toHaveBeenCalledWith('products/kelapa');
    });
  });

  describe('delete', () => {
    it('deletes product when requested by owner SELLER and cleans up Cloudinary asset', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      const result = await service.delete('product-uuid-1', {
        sub: 'seller-uuid-1',
        role: UserRole.SELLER,
      });

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'product-uuid-1' } });
      expect(cloudinary.deleteImage).toHaveBeenCalledWith('products/kelapa');
      expect(result).toEqual({ message: 'Product deleted successfully' });
    });

    it('rejects delete when caller is not the owner SELLER', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      await expect(
        service.delete('product-uuid-1', {
          sub: 'another-seller',
          role: UserRole.SELLER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when deleting non-existent product', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.delete('non-existent', {
          sub: 'seller-uuid-1',
          role: UserRole.SELLER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminDelete', () => {
    it('allows SUPERADMIN to force delete any product', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
      (prisma.product.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);

      const result = await service.adminDelete('product-uuid-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'product-uuid-1' } });
      expect(cloudinary.deleteImage).toHaveBeenCalledWith('products/kelapa');
      expect(result).toEqual({ message: 'Product deleted successfully' });
    });

    it('throws NotFoundException when admin deletes non-existent product', async () => {
      (prisma.product.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.adminDelete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
