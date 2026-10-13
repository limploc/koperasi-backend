import {
  BadRequestException,
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

const UUID_PIPE = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: () =>
    new BadRequestException({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: { id: ['Invalid UUID format'] },
    }),
});

@Controller('api/admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async adminDeleteProduct(@Param('id', UUID_PIPE) id: string) {
    const data = await this.productsService.adminDelete(id);
    return {
      success: true,
      message: 'Product deleted',
      data,
    };
  }
}
