import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import {
  mapProductToResponse,
  PaginationMetaResponse,
  ProductResponse,
} from './products.mapper.js';

export interface PaginatedProductsResponse {
  data: ProductResponse[];
  meta: PaginationMetaResponse;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedProductsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.search?.trim()) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { id: 'asc' },
    ];

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: items.map(mapProductToResponse),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<ProductResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id },
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

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    return mapProductToResponse(product);
  }

  async create(dto: CreateProductDto, sellerId: string): Promise<ProductResponse> {
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

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        category: dto.category,
        price: dto.price,
        unit: dto.unit,
        stock: dto.stock,
        short_description: dto.short_description ?? null,
        image_url: dto.image_url ?? null,
        seller_id: sellerId,
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

    return mapProductToResponse(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: { sub: string; role: UserRole },
  ): Promise<ProductResponse> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
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

    if (!existing) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (user.role === UserRole.SELLER && existing.seller_id !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden - not owner or not SELLER',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    const updateData: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.unit !== undefined) updateData.unit = dto.unit;
    if (dto.stock !== undefined) updateData.stock = dto.stock;
    if (dto.short_description !== undefined) updateData.short_description = dto.short_description;
    if (dto.image_url !== undefined) updateData.image_url = dto.image_url;

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
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

    // Handle old Cloudinary asset cleanup if image was replaced
    if (
      dto.image_url !== undefined &&
      existing.image_url &&
      existing.image_url !== dto.image_url &&
      this.cloudinaryService.isCloudinaryUrl(existing.image_url)
    ) {
      const publicId = this.cloudinaryService.extractPublicIdFromUrl(existing.image_url);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to cleanup replaced Cloudinary asset ${publicId}: ${msg}`);
        });
      }
    }

    return mapProductToResponse(updated);
  }

  async delete(id: string, user: { sub: string; role: UserRole }): Promise<{ message: string }> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, seller_id: true, image_url: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (user.role === UserRole.SELLER && existing.seller_id !== user.sub) {
      throw new ForbiddenException({
        message: 'Forbidden - not owner or not SELLER',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    // Delete from database first to avoid leaving DB in inconsistent state if delete fails
    await this.prisma.product.delete({
      where: { id },
    });

    // Cleanup Cloudinary asset if applicable
    if (existing.image_url && this.cloudinaryService.isCloudinaryUrl(existing.image_url)) {
      const publicId = this.cloudinaryService.extractPublicIdFromUrl(existing.image_url);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to cleanup deleted product Cloudinary asset ${publicId}: ${msg}`);
        });
      }
    }

    return { message: 'Product deleted successfully' };
  }

  async adminDelete(id: string): Promise<{ message: string }> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, image_url: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.prisma.product.delete({
      where: { id },
    });

    if (existing.image_url && this.cloudinaryService.isCloudinaryUrl(existing.image_url)) {
      const publicId = this.cloudinaryService.extractPublicIdFromUrl(existing.image_url);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to cleanup admin-deleted product Cloudinary asset ${publicId}: ${msg}`);
        });
      }
    }

    return { message: 'Product deleted successfully' };
  }
}
