import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('UsersController', () => {
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

  it('delegates listUsers and returns standard envelope', async () => {
    const usersService = {
      findAll: vi.fn().mockResolvedValue({
        data: [mockUserResponse],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(UsersController);
    const query = { page: 1, limit: 20 };
    const result = await controller.listUsers(query);

    expect(result).toEqual({
      success: true,
      message: 'List of users',
      data: {
        data: [mockUserResponse],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
    expect(usersService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates getUserById and returns standard envelope', async () => {
    const usersService = {
      findById: vi.fn().mockResolvedValue(mockUserResponse),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(UsersController);
    const result = await controller.getUserById('user-uuid-1');

    expect(result).toEqual({
      success: true,
      message: 'User detail',
      data: mockUserResponse,
    });
    expect(usersService.findById).toHaveBeenCalledWith('user-uuid-1');
  });
});
