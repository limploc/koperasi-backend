import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AccessTokenPayload } from '../common/types/auth.types.js';

const UUID_PIPE = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: () =>
    new BadRequestException({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: { id: ['Invalid UUID format'] },
    }),
});

@Controller('api/ecommerce/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async listProducts(@Query() query: ProductQueryDto) {
    const data = await this.productsService.findAll(query);
    return {
      success: true,
      message: 'List of products',
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createProduct(
    @Body() dto: CreateProductDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.productsService.create(dto, req.user.sub);
    return {
      success: true,
      message: 'Product created',
      data,
    };
  }

  @Get(':id')
  async getProductById(@Param('id', UUID_PIPE) id: string) {
    const data = await this.productsService.findById(id);
    return {
      success: true,
      message: 'Product detail',
      data,
    };
  }

  @Put(':id')
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateProduct(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.productsService.update(id, dto, {
      sub: req.user.sub,
      role: req.user.role,
    });
    return {
      success: true,
      message: 'Product updated',
      data,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteProduct(
    @Param('id', UUID_PIPE) id: string,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.productsService.delete(id, {
      sub: req.user.sub,
      role: req.user.role,
    });
    return {
      success: true,
      message: 'Product deleted',
      data,
    };
  }
}
