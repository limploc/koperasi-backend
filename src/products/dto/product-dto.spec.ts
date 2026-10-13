import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductDto } from './create-product.dto.js';
import { UpdateProductDto } from './update-product.dto.js';
import { ProductQueryDto } from './product-query.dto.js';
import { ProductCategory } from '@prisma/client';

describe('Product DTOs Validation', () => {
  describe('CreateProductDto', () => {
    it('validates a valid CreateProductDto', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Kelapa Segar Pilihan',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: 50,
        short_description: 'Kelapa pilihan langsung dari petani',
        image_url: 'https://example.com/kelapa.jpg',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects product with name shorter than 3 characters', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'ab',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: 50,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('rejects product with invalid category', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Kelapa Segar',
        category: 'buah' as unknown as ProductCategory,
        price: 15000,
        unit: 'kg',
        stock: 50,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });

    it('rejects negative price', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Kelapa Segar',
        category: ProductCategory.kelapa,
        price: -100,
        unit: 'kg',
        stock: 50,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'price')).toBe(true);
    });

    it('rejects negative stock', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Kelapa Segar',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: -5,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'stock')).toBe(true);
    });

    it('rejects invalid image_url format', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Kelapa Segar',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: 50,
        image_url: 'not-a-valid-url',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'image_url')).toBe(true);
    });
  });

  describe('UpdateProductDto', () => {
    it('allows partial updates with valid fields', async () => {
      const dto = plainToInstance(UpdateProductDto, {
        price: 20000,
        stock: 30,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('rejects invalid price on update', async () => {
      const dto = plainToInstance(UpdateProductDto, {
        price: -500,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'price')).toBe(true);
    });

    it('rejects invalid category on update', async () => {
      const dto = plainToInstance(UpdateProductDto, {
        category: 'invalid' as unknown as ProductCategory,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });
  });

  describe('ProductQueryDto', () => {
    it('sets default pagination and sorting values', async () => {
      const dto = plainToInstance(ProductQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
      expect(dto.sortBy).toBe('created_at');
      expect(dto.sortOrder).toBe('desc');
    });

    it('validates supported sortBy and sortOrder', async () => {
      const dto = plainToInstance(ProductQueryDto, {
        page: '2',
        limit: '25',
        sortBy: 'price',
        sortOrder: 'asc',
        category: ProductCategory.jagung,
        search: 'jagung manis',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(25);
    });

    it('rejects invalid sortBy field', async () => {
      const dto = plainToInstance(ProductQueryDto, {
        sortBy: 'invalid_column',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
    });

    it('rejects invalid sortOrder direction', async () => {
      const dto = plainToInstance(ProductQueryDto, {
        sortOrder: 'upwards',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
    });

    it('rejects limit greater than 100', async () => {
      const dto = plainToInstance(ProductQueryDto, {
        limit: 101,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
