import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('AdminUsersController', () => {
  const mockUserResponse = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    phone_number: '08123456789',
    role: UserRole.BUYER,
    name: 'Test User',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const req = {
    user: {
      sub: 'admin-uuid-1',
      role: UserRole.SUPERADMIN,
      sid: 'session-id',
      type: 'access' as const,
    },
  };

  it('delegates adminListUsers and returns standard envelope', async () => {
    const adminUsersService = {
      findAll: vi.fn().mockResolvedValue({
        data: [mockUserResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminUsersController);
    const query = { page: 1, limit: 10 };
    const result = await controller.adminListUsers(query);

    expect(result).toEqual({
      success: true,
      message: 'List of users',
      data: {
        data: [mockUserResponse],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    expect(adminUsersService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates adminGetUser and returns standard envelope', async () => {
    const adminUsersService = {
      findById: vi.fn().mockResolvedValue(mockUserResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminUsersController);
    const result = await controller.adminGetUser('user-uuid-1');

    expect(result).toEqual({
      success: true,
      message: 'User detail',
      data: mockUserResponse,
    });
    expect(adminUsersService.findById).toHaveBeenCalledWith('user-uuid-1');
  });

  it('delegates adminUpdateUser and returns standard envelope', async () => {
    const updatedUser = { ...mockUserResponse, role: UserRole.SELLER };
    const adminUsersService = {
      update: vi.fn().mockResolvedValue(updatedUser),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminUsersController);
    const dto = { role: UserRole.SELLER };
    const result = await controller.adminUpdateUser('user-uuid-1', dto, req as never);

    expect(result).toEqual({
      success: true,
      message: 'User updated',
      data: updatedUser,
    });
    expect(adminUsersService.update).toHaveBeenCalledWith('user-uuid-1', dto, 'admin-uuid-1');
  });

  it('delegates adminDeleteUser and returns standard envelope', async () => {
    const adminUsersService = {
      delete: vi.fn().mockResolvedValue({ message: 'User deactivated successfully' }),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminUsersController);
    const result = await controller.adminDeleteUser('user-uuid-1', req as never);

    expect(result).toEqual({
      success: true,
      message: 'User deactivated',
      data: { message: 'User deactivated successfully' },
    });
    expect(adminUsersService.delete).toHaveBeenCalledWith('user-uuid-1', 'admin-uuid-1');
  });
});
