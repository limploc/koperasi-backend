import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PricingType, UserRole } from '@prisma/client';
import { RentalController } from './rental.controller.js';
import { RentalService } from './rental.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('RentalController', () => {
  const mockRentalItemResponse = {
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
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const sellerReq = {
    user: {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
      sid: 'session-id',
      type: 'access' as const,
    },
  };

  it('delegates listRentalItems and returns standard envelope', async () => {
    const rentalService = {
      findAll: vi.fn().mockResolvedValue({
        data: [mockRentalItemResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [RentalController],
      providers: [{ provide: RentalService, useValue: rentalService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(RentalController);
    const query = { page: 1, limit: 10 };
    const result = await controller.listRentalItems(query);

    expect(result).toEqual({
      success: true,
      message: 'List of rental items',
      data: {
        data: [mockRentalItemResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(rentalService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates createRentalItem and returns 201 envelope', async () => {
    const rentalService = {
      create: vi.fn().mockResolvedValue(mockRentalItemResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [RentalController],
      providers: [{ provide: RentalService, useValue: rentalService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(RentalController);
    const dto = {
      name: 'Traktor Tani 50HP',
      available_units: 3,
      pricing_type: PricingType.per_day,
    };
    const result = await controller.createRentalItem(dto, sellerReq as never);

    expect(result).toEqual({
      success: true,
      message: 'Rental item created',
      data: mockRentalItemResponse,
    });
    expect(rentalService.create).toHaveBeenCalledWith(dto, 'seller-uuid-1');
  });

  it('delegates getRentalItemById and returns standard envelope', async () => {
    const rentalService = {
      findById: vi.fn().mockResolvedValue(mockRentalItemResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [RentalController],
      providers: [{ provide: RentalService, useValue: rentalService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(RentalController);
    const result = await controller.getRentalItemById('rental-uuid-1');

    expect(result).toEqual({
      success: true,
      message: 'Rental item detail',
      data: mockRentalItemResponse,
    });
    expect(rentalService.findById).toHaveBeenCalledWith('rental-uuid-1');
  });

  it('delegates updateRentalItem and returns standard envelope', async () => {
    const updated = { ...mockRentalItemResponse, name: 'Updated' };
    const rentalService = {
      update: vi.fn().mockResolvedValue(updated),
    };

    const module = await Test.createTestingModule({
      controllers: [RentalController],
      providers: [{ provide: RentalService, useValue: rentalService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(RentalController);
    const dto = { name: 'Updated' };
    const result = await controller.updateRentalItem('rental-uuid-1', dto, sellerReq as never);

    expect(result).toEqual({
      success: true,
      message: 'Rental item updated',
      data: updated,
    });
    expect(rentalService.update).toHaveBeenCalledWith('rental-uuid-1', dto, {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
    });
  });

  it('delegates deleteRentalItem and returns standard envelope', async () => {
    const rentalService = {
      delete: vi.fn().mockResolvedValue({ message: 'Rental item deleted successfully' }),
    };

    const module = await Test.createTestingModule({
      controllers: [RentalController],
      providers: [{ provide: RentalService, useValue: rentalService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(RentalController);
    const result = await controller.deleteRentalItem('rental-uuid-1', sellerReq as never);

    expect(result).toEqual({
      success: true,
      message: 'Rental item deleted',
      data: { message: 'Rental item deleted successfully' },
    });
    expect(rentalService.delete).toHaveBeenCalledWith('rental-uuid-1', {
      sub: 'seller-uuid-1',
      role: UserRole.SELLER,
    });
  });
});
