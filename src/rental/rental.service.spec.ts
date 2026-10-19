import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingType, UserRole } from '@prisma/client';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RentalService } from './rental.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('RentalService', () => {
  let service: RentalService;
  let prisma: {
    rentalItem: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  const mockDate = new Date('2024-01-01T00:00:00.000Z');

  const mockRentalItem = {
    id: 'rental-uuid-1',
    seller_id: 'seller-uuid-1',
    name: 'Traktor Tani 50HP',
    description: 'Traktor sawah',
    images: ['https://example.com/tractor.jpg'],
    available_units: 3,
    pricing_type: PricingType.per_day,
    price_per_hour: 25000,
    price_per_day: 150000,
    price_per_week: 800000,
    created_at: mockDate,
    updated_at: mockDate,
  };

  beforeEach(() => {
    prisma = {
      rentalItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    };
    service = new RentalService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated rental items with default options', async () => {
      prisma.rentalItem.count.mockResolvedValue(1);
      prisma.rentalItem.findMany.mockResolvedValue([mockRentalItem]);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockRentalItem.id);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(prisma.rentalItem.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      });
    });

    it('filters by pricing_type and search', async () => {
      prisma.rentalItem.count.mockResolvedValue(1);
      prisma.rentalItem.findMany.mockResolvedValue([mockRentalItem]);

      await service.findAll({
        pricing_type: PricingType.per_day,
        search: 'Traktor',
        page: 2,
        limit: 5,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(prisma.rentalItem.findMany).toHaveBeenCalledWith({
        where: {
          pricing_type: PricingType.per_day,
          name: { contains: 'Traktor', mode: 'insensitive' },
        },
        skip: 5,
        take: 5,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
    });
  });

  describe('findById', () => {
    it('returns rental item when exists', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);

      const result = await service.findById('rental-uuid-1');

      expect(result.id).toBe('rental-uuid-1');
      expect(result.name).toBe('Traktor Tani 50HP');
    });

    it('throws NotFoundException when rental item not found', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates and returns a new rental item', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'seller-uuid-1',
        role: UserRole.SELLER,
        is_active: true,
      });
      prisma.rentalItem.create.mockResolvedValue(mockRentalItem);

      const dto = {
        name: 'Traktor Tani 50HP',
        description: 'Traktor sawah',
        images: ['https://example.com/tractor.jpg'],
        available_units: 3,
        pricing_type: PricingType.per_day,
        price_per_day: 150000,
      };

      const result = await service.create(dto, 'seller-uuid-1');

      expect(result.id).toBe(mockRentalItem.id);
      expect(prisma.rentalItem.create).toHaveBeenCalled();
    });

    it('throws UnauthorizedException if seller does not exist or inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Traktor',
            available_units: 1,
            pricing_type: PricingType.per_day,
          },
          'invalid-seller',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('update', () => {
    it('updates rental item when user is owner', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);
      const updatedMock = { ...mockRentalItem, name: 'Updated Traktor' };
      prisma.rentalItem.update.mockResolvedValue(updatedMock);

      const result = await service.update(
        'rental-uuid-1',
        { name: 'Updated Traktor' },
        { sub: 'seller-uuid-1', role: UserRole.SELLER },
      );

      expect(result.name).toBe('Updated Traktor');
      expect(prisma.rentalItem.update).toHaveBeenCalledWith({
        where: { id: 'rental-uuid-1' },
        data: { name: 'Updated Traktor' },
      });
    });

    it('updates rental item when user is SUPERADMIN even if not owner', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);
      const updatedMock = { ...mockRentalItem, name: 'Admin Edited' };
      prisma.rentalItem.update.mockResolvedValue(updatedMock);

      const result = await service.update(
        'rental-uuid-1',
        { name: 'Admin Edited' },
        { sub: 'admin-uuid-1', role: UserRole.SUPERADMIN },
      );

      expect(result.name).toBe('Admin Edited');
    });

    it('throws ForbiddenException if seller is not owner', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);

      await expect(
        service.update(
          'rental-uuid-1',
          { name: 'Hacked' },
          { sub: 'different-seller', role: UserRole.SELLER },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if rental item does not exist', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'non-existent',
          { name: 'Test' },
          { sub: 'seller-uuid-1', role: UserRole.SELLER },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes rental item when user is owner', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);
      prisma.rentalItem.delete.mockResolvedValue(mockRentalItem);

      const result = await service.delete('rental-uuid-1', {
        sub: 'seller-uuid-1',
        role: UserRole.SELLER,
      });

      expect(result).toEqual({ message: 'Rental item deleted successfully' });
      expect(prisma.rentalItem.delete).toHaveBeenCalledWith({
        where: { id: 'rental-uuid-1' },
      });
    });

    it('deletes rental item when user is SUPERADMIN', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);
      prisma.rentalItem.delete.mockResolvedValue(mockRentalItem);

      const result = await service.delete('rental-uuid-1', {
        sub: 'admin-uuid-1',
        role: UserRole.SUPERADMIN,
      });

      expect(result).toEqual({ message: 'Rental item deleted successfully' });
    });

    it('throws ForbiddenException if seller is not owner', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(mockRentalItem);

      await expect(
        service.delete('rental-uuid-1', {
          sub: 'different-seller',
          role: UserRole.SELLER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if rental item does not exist', async () => {
      prisma.rentalItem.findUnique.mockResolvedValue(null);

      await expect(
        service.delete('non-existent', {
          sub: 'seller-uuid-1',
          role: UserRole.SELLER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
