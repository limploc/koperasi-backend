import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { ProductCategory, UserRole } from '@prisma/client';

describe('Products E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  let sellerToken: string;
  let sellerId: string;
  let seller2Token: string;
  let buyerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('DATABASE_URL_TEST is not configured.');
    }
    if (process.env.DATABASE_URL && !testDbUrl.includes('_test')) {
      throw new Error('Safety check failed: database URL does not appear to be a test database.');
    }

    process.env.JWT_ACCESS_SECRET = 'e2e-only-access-secret-change-me';
    process.env.JWT_REFRESH_SECRET = 'e2e-only-refresh-secret-change-me';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const { AppModule } = await import('../src/app.module.js');
    const { ApiExceptionFilter } = await import('../src/common/filters/api-exception.filter.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    cloudinaryService = moduleFixture.get<CloudinaryService>(CloudinaryService);

    vi.spyOn(cloudinaryService, 'deleteImage').mockResolvedValue(true);

    const registerUser = async (role: 'BUYER' | 'SELLER', prefix: string) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        email: `${prefix}-${unique}@example.test`,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: 'Password123!',
        role,
        name: `Test ${prefix}`,
      };

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      createdUserIds.push(res.body.data.user.id);
      return {
        id: res.body.data.user.id,
        token: res.body.data.access_token as string,
        email: payload.email,
      };
    };

    const seller = await registerUser('SELLER', 'seller1');
    sellerId = seller.id;
    sellerToken = seller.token;

    const seller2 = await registerUser('SELLER', 'seller2');
    seller2Token = seller2.token;

    const buyer = await registerUser('BUYER', 'buyer');
    buyerToken = buyer.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `admin-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin E2E',
      },
    });
    createdUserIds.push(adminUser.id);

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);

    adminToken = adminLoginRes.body.data.access_token;
  }, 40000);

  afterAll(async () => {
    try {
      if (createdProductIds.length > 0) {
        await prisma.product.deleteMany({
          where: { id: { in: createdProductIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch {
    }

    await app?.close();
  });

  describe('POST /api/ecommerce/products (Create product)', () => {
    it('creates a new product successfully with valid payload (SELLER role)', async () => {
      const payload = {
        name: 'Kelapa Hijau Segar',
        category: 'kelapa',
        price: 15000,
        unit: 'kg',
        stock: 50,
        short_description: 'Kelapa hijau kualitas super',
        image_url: 'https://res.cloudinary.com/testcloud/image/upload/v12345/products/kelapa-hijau.jpg',
      };

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product created',
        data: {
          id: expect.any(String),
          seller_id: sellerId,
          name: payload.name,
          category: payload.category,
          price: payload.price,
          unit: payload.unit,
          stock: payload.stock,
          short_description: payload.short_description,
          image_url: payload.image_url,
          seller: {
            id: sellerId,
            role: 'SELLER',
          },
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });

      createdProductIds.push(res.body.data.id);

      const dbProduct = await prisma.product.findUnique({
        where: { id: res.body.data.id },
      });
      expect(dbProduct).not.toBeNull();
      expect(dbProduct?.name).toBe(payload.name);
      expect(dbProduct?.price).toBe(payload.price);
    });

    it('rejects product creation without authentication (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/products')
        .send({
          name: 'Kelapa Bulat',
          category: 'kelapa',
          price: 10000,
          unit: 'butir',
          stock: 20,
        })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
        meta: { timestamp: expect.any(String) },
      });
    });

    it('rejects product creation with unauthorized role like BUYER (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/products')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Kelapa Muda',
          category: 'kelapa',
          price: 12000,
          unit: 'butir',
          stock: 30,
        })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
        meta: { timestamp: expect.any(String) },
      });
    });

    it('rejects invalid payloads with 400 VALIDATION_ERROR (missing required fields)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('rejects invalid field types/values (negative price, invalid category)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'AB',
          category: 'invalid_cat',
          price: -500,
          unit: '',
          stock: -10,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/ecommerce/products/:id (Get product by ID)', () => {
    let testProductId: string;

    beforeAll(async () => {
      const product = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Jagung Manis Organik',
          category: ProductCategory.jagung,
          price: 8000,
          unit: 'kg',
          stock: 200,
          short_description: 'Jagung manis pilihan langsung dari kebun',
          image_url: 'https://cdn.example.com/jagung.jpg',
        },
      });
      testProductId = product.id;
      createdProductIds.push(testProductId);
    });

    it('retrieves an existing product by ID without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/products/${testProductId}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product detail',
        data: {
          id: testProductId,
          seller_id: sellerId,
          name: 'Jagung Manis Organik',
          category: 'jagung',
          price: 8000,
          unit: 'kg',
          stock: 200,
          short_description: 'Jagung manis pilihan langsung dari kebun',
          image_url: 'https://cdn.example.com/jagung.jpg',
          seller: {
            id: sellerId,
            role: 'SELLER',
          },
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND when product does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/products/${nonExistentId}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        message: 'Product not found',
        error: { code: 'RESOURCE_NOT_FOUND' },
        meta: { timestamp: expect.any(String) },
      });
    });

    it('returns 400 VALIDATION_ERROR when ID is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products/invalid-uuid-123')
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });

  describe('GET /api/ecommerce/products (List products with filters, sorting, pagination)', () => {
    let listProduct1Id: string;
    let listProduct2Id: string;
    let listProduct3Id: string;

    beforeAll(async () => {
      const p1 = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Alpha Kelapa Parut Segar',
          category: ProductCategory.kelapa,
          price: 10000,
          unit: 'kg',
          stock: 50,
        },
      });
      const p2 = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Beta Jagung Pipil Kering',
          category: ProductCategory.jagung,
          price: 25000,
          unit: 'kg',
          stock: 100,
        },
      });
      const p3 = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Gamma Minyak Kelapa Turunan',
          category: ProductCategory.turunan,
          price: 50000,
          unit: 'liter',
          stock: 10,
        },
      });

      listProduct1Id = p1.id;
      listProduct2Id = p2.id;
      listProduct3Id = p3.id;
      createdProductIds.push(listProduct1Id, listProduct2Id, listProduct3Id);
    });

    it('lists products and complies with pagination response envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'List of products',
        data: {
          data: expect.any(Array),
          meta: {
            page: 1,
            limit: 10,
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        },
      });
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(3);
    });

    it('filters products by category', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ category: 'jagung' })
        .expect(200);

      expect(res.body.success).toBe(true);
      const items = res.body.data.data;
      expect(items.length).toBeGreaterThanOrEqual(1);
      items.forEach((item: { category: string }) => {
        expect(item.category).toBe('jagung');
      });
    });

    it('searches products by name query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ search: 'Minyak Kelapa Turunan' })
        .expect(200);

      expect(res.body.success).toBe(true);
      const items = res.body.data.data;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].name).toContain('Minyak Kelapa Turunan');
    });

    it('sorts products by price ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ sortBy: 'price', sortOrder: 'asc', limit: 50 })
        .expect(200);

      expect(res.body.success).toBe(true);
      const prices: number[] = res.body.data.data.map((p: { price: number }) => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('handles pagination limit and page offset', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(res.body.data.data.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta.limit).toBe(2);
      expect(res.body.data.meta.page).toBe(1);
    });

    it('rejects invalid query parameters (invalid limit, invalid category)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/products')
        .query({ limit: 500, category: 'non_existent_category' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/ecommerce/products/:id (Update product)', () => {
    let ownedProductId: string;

    beforeEach(async () => {
      const p = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Kelapa Parut Asli',
          category: ProductCategory.kelapa,
          price: 12000,
          unit: 'kg',
          stock: 40,
          image_url: 'https://res.cloudinary.com/testcloud/image/upload/v1/products/old-kelapa.jpg',
        },
      });
      ownedProductId = p.id;
      createdProductIds.push(ownedProductId);
    });

    it('updates own product successfully (SELLER owner)', async () => {
      const updatePayload = {
        name: 'Kelapa Parut Asli Super',
        price: 14000,
        stock: 35,
        short_description: 'Kelapa parut kualitas terjamin',
        image_url: 'https://res.cloudinary.com/testcloud/image/upload/v2/products/new-kelapa.jpg',
      };

      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${ownedProductId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(updatePayload)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product updated',
        data: {
          id: ownedProductId,
          name: updatePayload.name,
          price: updatePayload.price,
          stock: updatePayload.stock,
          short_description: updatePayload.short_description,
          image_url: updatePayload.image_url,
        },
      });

      const updatedDb = await prisma.product.findUnique({
        where: { id: ownedProductId },
      });
      expect(updatedDb?.name).toBe(updatePayload.name);
      expect(updatedDb?.price).toBe(updatePayload.price);

      expect(cloudinaryService.deleteImage).toHaveBeenCalled();
    });

    it('rejects update without authentication (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${ownedProductId}`)
        .send({ price: 20000 })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects update by a different SELLER who does not own the product (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${ownedProductId}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ price: 99999 })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ACCESS');
    });

    it('rejects update by BUYER (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${ownedProductId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ price: 10000 })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ACCESS');
    });

    it('returns 404 RESOURCE_NOT_FOUND when updating non-existent product', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${nonExistent}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ name: 'Valid Name Here' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects invalid payload during update (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/products/${ownedProductId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: -100 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/ecommerce/products/:id (Delete own product)', () => {
    let toDeleteProductId: string;

    beforeEach(async () => {
      const p = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Kelapa Tempurung Siap Hapus',
          category: ProductCategory.kelapa,
          price: 5000,
          unit: 'karung',
          stock: 10,
          image_url: 'https://res.cloudinary.com/testcloud/image/upload/v1/products/tempurung.jpg',
        },
      });
      toDeleteProductId = p.id;
      createdProductIds.push(toDeleteProductId);
    });

    it('deletes own product successfully (SELLER owner)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/products/${toDeleteProductId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product deleted',
        data: {
          message: 'Product deleted successfully',
        },
      });

      const dbRecord = await prisma.product.findUnique({
        where: { id: toDeleteProductId },
      });
      expect(dbRecord).toBeNull();

      expect(cloudinaryService.deleteImage).toHaveBeenCalled();
    });

    it('rejects delete without authentication (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/products/${toDeleteProductId}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects delete by a non-owner seller (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/products/${toDeleteProductId}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ACCESS');
    });

    it('rejects delete by BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/products/${toDeleteProductId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ACCESS');
    });

    it('returns 404 RESOURCE_NOT_FOUND when deleting non-existent product', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/products/${nonExistent}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('DELETE /api/admin/products/:id (Delete any product - SUPERADMIN only)', () => {
    let adminTargetProductId: string;

    beforeEach(async () => {
      const p = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Produk Untuk Admin Hapus',
          category: ProductCategory.turunan,
          price: 30000,
          unit: 'botol',
          stock: 5,
        },
      });
      adminTargetProductId = p.id;
      createdProductIds.push(adminTargetProductId);
    });

    it('deletes any product when authenticated as SUPERADMIN', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/products/${adminTargetProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product deleted',
        data: {
          message: 'Product deleted successfully',
        },
      });

      const dbProduct = await prisma.product.findUnique({
        where: { id: adminTargetProductId },
      });
      expect(dbProduct).toBeNull();
    });

    it('rejects admin delete without authentication (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/products/${adminTargetProductId}`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejects admin delete by non-admin roles (SELLER, BUYER: 403 FORBIDDEN_ACCESS)', async () => {
      const sellerRes = await request(app.getHttpServer())
        .delete(`/api/admin/products/${adminTargetProductId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(sellerRes.body.success).toBe(false);
      expect(sellerRes.body.error.code).toBe('FORBIDDEN_ACCESS');

      const buyerRes = await request(app.getHttpServer())
        .delete(`/api/admin/products/${adminTargetProductId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(buyerRes.body.success).toBe(false);
      expect(buyerRes.body.error.code).toBe('FORBIDDEN_ACCESS');
    });

    it('returns 404 RESOURCE_NOT_FOUND when admin deletes nonexistent product', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/products/${nonExistent}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
