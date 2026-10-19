import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { CreateRentalItemDto } from './dto/create-rental-item.dto.js';
import { UpdateRentalItemDto } from './dto/update-rental-item.dto.js';
import { RentalItemQueryDto } from './dto/rental-item-query.dto.js';
import {
  mapRentalItemToResponse,
  PaginatedRentalItemsResponse,
  RentalItemResponse,
} from './rental.mapper.js';

@Injectable()
export class RentalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: RentalItemQueryDto): Promise<PaginatedRentalItemsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RentalItemWhereInput = {};

    if (query.pricing_type) {
      where.pricing_type = query.pricing_type;
    }

    if (query.search?.trim()) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.RentalItemOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { id: 'asc' },
    ];

    const [total, items] = await Promise.all([
      this.prisma.rentalItem.count({ where }),
      this.prisma.rentalItem.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items.map(mapRentalItemToResponse),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<RentalItemResponse> {
    const item = await this.prisma.rentalItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException({
        message: 'Rental item not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return mapRentalItemToResponse(item);
  }

  async create(dto: CreateRentalItemDto, sellerId: string): Promise<RentalItemResponse> {
    const seller = await this.prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, role: true, is_active: true },
    });

    if (!seller || !seller.is_active) {
      throw new UnauthorizedException({
        message: 'Unauthorized',
        code: 'AUTH_REQUIRED',
      });
    }

    const item = await this.prisma.rentalItem.create({
      data: {
        seller_id: sellerId,
        name: dto.name,
        description: dto.description ?? null,
        images: dto.images ? dto.images : Prisma.JsonNull,
        available_units: dto.available_units,
        pricing_type: dto.pricing_type,
        price_per_hour: dto.price_per_hour ?? null,
        price_per_day: dto.price_per_day ?? null,
        price_per_week: dto.price_per_week ?? null,
      },
    });

    return mapRentalItemToResponse(item);
  }

  async update(
    id: string,
    dto: UpdateRentalItemDto,
    user: { sub: string; role: UserRole },
  ): Promise<RentalItemResponse> {
    const existing = await this.prisma.rentalItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Rental item not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (user.role === UserRole.SELLER && existing.seller_id !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden - not owner or not SELLER',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    const updateData: Prisma.RentalItemUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.images !== undefined) {
      updateData.images = dto.images ? dto.images : Prisma.JsonNull;
    }
    if (dto.available_units !== undefined) updateData.available_units = dto.available_units;
    if (dto.pricing_type !== undefined) updateData.pricing_type = dto.pricing_type;
    if (dto.price_per_hour !== undefined) updateData.price_per_hour = dto.price_per_hour;
    if (dto.price_per_day !== undefined) updateData.price_per_day = dto.price_per_day;
    if (dto.price_per_week !== undefined) updateData.price_per_week = dto.price_per_week;

    const updated = await this.prisma.rentalItem.update({
      where: { id },
      data: updateData,
    });

    return mapRentalItemToResponse(updated);
  }

  async delete(
    id: string,
    user: { sub: string; role: UserRole },
  ): Promise<{ message: string }> {
    const existing = await this.prisma.rentalItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Rental item not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (user.role === UserRole.SELLER && existing.seller_id !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden - not owner or not SELLER',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    await this.prisma.rentalItem.delete({
      where: { id },
    });

    return { message: 'Rental item deleted successfully' };
  }
}
