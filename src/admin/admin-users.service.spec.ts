import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AdminUsersService } from './admin-users.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: PrismaService;

  const mockAdmin = {
    id: 'admin-uuid-1',
    email: 'admin@example.com',
    phone_number: '08111111111',
    role: UserRole.SUPERADMIN,
    name: 'Admin User',
    is_active: true,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    phone_number: '08123456789',
    role: UserRole.BUYER,
    name: 'Regular User',
    is_active: true,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    service = new AdminUsersService(prisma);
  });

  describe('findAll', () => {
    it('returns paginated users with meta', async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('user-uuid-1');
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('filters by role and search query', async () => {
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.findAll({
        page: 1,
        limit: 10,
        role: UserRole.SELLER,
        search: 'seller',
      });

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          role: UserRole.SELLER,
          OR: [
            { name: { contains: 'seller', mode: 'insensitive' } },
            { email: { contains: 'seller', mode: 'insensitive' } },
            { phone_number: { contains: 'seller', mode: 'insensitive' } },
          ],
        },
      });
    });
  });

  describe('findById', () => {
    it('returns user details when found', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('user@example.com');
    });

    it('throws NotFoundException when user not found', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.findById('unknown-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when user does not exist', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.update('unknown', { role: UserRole.SELLER }, 'admin-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('prevents admin from deactivating own account', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdmin);

      await expect(
        service.update('admin-uuid-1', { is_active: false }, 'admin-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents admin from demoting own SUPERADMIN role', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdmin);

      await expect(
        service.update('admin-uuid-1', { role: UserRole.BUYER }, 'admin-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully updates role and status of another user', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        role: UserRole.SELLER,
        is_active: false,
      });

      const result = await service.update(
        'user-uuid-1',
        { role: UserRole.SELLER, is_active: false },
        'admin-uuid-1',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { role: UserRole.SELLER, is_active: false },
      });
      expect(result.role).toBe(UserRole.SELLER);
      expect(result.is_active).toBe(false);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when user not found', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.delete('unknown', 'admin-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('prevents admin from deactivating own account', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdmin);

      await expect(service.delete('admin-uuid-1', 'admin-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deactivates target user successfully', async () => {
      (prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
      (prisma.user.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockUser,
        is_active: false,
      });

      const result = await service.delete('user-uuid-1', 'admin-uuid-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { is_active: false },
      });
      expect(result).toEqual({ message: 'User deactivated successfully' });
    });
  });
});
