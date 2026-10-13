import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AdminProductsController } from './admin-products.controller.js';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('AdminProductsController', () => {
  it('delegates adminDeleteProduct and returns envelope', async () => {
    const productsService = {
      adminDelete: vi.fn().mockResolvedValue({ message: 'Product deleted successfully' }),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminProductsController);
    const result = await controller.adminDeleteProduct('product-uuid-1');

    expect(result).toEqual({
      success: true,
      message: 'Product deleted',
      data: { message: 'Product deleted successfully' },
    });
    expect(productsService.adminDelete).toHaveBeenCalledWith('product-uuid-1');
  });
});
