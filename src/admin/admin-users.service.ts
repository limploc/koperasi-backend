import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { AdminUserQueryDto } from './dto/admin-user-query.dto.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { mapUserToResponse, UserResponse } from './admin.mapper.js';
import { PaginationMetaResponse } from '../products/products.mapper.js';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: AdminUserQueryDto,
  ): Promise<{ data: UserResponse[]; meta: PaginationMetaResponse }> {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone_number: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      data: users.map(mapUserToResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return mapUserToResponse(user);
  }

  async update(
    id: string,
    dto: AdminUpdateUserDto,
    adminId: string,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (adminId === id) {
      if (dto.is_active === false) {
        throw new BadRequestException({
          message: 'Cannot deactivate own SUPERADMIN account',
          code: 'VALIDATION_ERROR',
        });
      }

      if (dto.role && dto.role !== UserRole.SUPERADMIN) {
        throw new BadRequestException({
          message: 'Cannot demote own SUPERADMIN account',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.role !== undefined) {
      data.role = dto.role;
    }
    if (dto.is_active !== undefined) {
      data.is_active = dto.is_active;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return mapUserToResponse(updated);
  }

  async delete(id: string, adminId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (adminId === id) {
      throw new BadRequestException({
        message: 'Cannot deactivate own SUPERADMIN account',
        code: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.user.update({
      where: { id },
      data: { is_active: false },
    });

    return { message: 'User deactivated successfully' };
  }
}
