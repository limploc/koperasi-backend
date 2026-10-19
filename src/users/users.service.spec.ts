import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { AdminUsersService } from '../admin/admin-users.service.js';
import { UserResponse } from '../admin/admin.mapper.js';

describe('UsersService', () => {
  let service: UsersService;
  let adminUsersService: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };

  const mockUser: UserResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    phone_number: '08123456789',
    role: UserRole.BUYER,
    name: 'Test Buyer',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    adminUsersService = {
      findAll: vi.fn(),
      findById: vi.fn(),
    };
    service = new UsersService(adminUsersService as unknown as AdminUsersService);
  });

  describe('findAll', () => {
    it('returns paginated users from admin service', async () => {
      const mockResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };
      adminUsersService.findAll.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20, role: UserRole.BUYER };
      const result = await service.findAll(query);

      expect(result).toEqual(mockResult);
      expect(adminUsersService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('returns user detail when user exists', async () => {
      adminUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(adminUsersService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('propagates NotFoundException when user does not exist', async () => {
      adminUsersService.findById.mockRejectedValue(
        new NotFoundException({
          message: 'User not found',
          code: 'RESOURCE_NOT_FOUND',
        }),
      );

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
