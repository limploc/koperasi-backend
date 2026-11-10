import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { PricingType, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

describe('Rental E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdRentalItemIds: string[] = [];

  let seller1Token: string;
  let seller1Id: string;
  let seller2Token: string;
  let buyerToken: string;
  let superadminToken: string;

  let testRentalItem1Id: string;

  beforeAll(async () => {
    const testDbUrl = process.env.DATABASE_URL_TEST;
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
    const { AuthRateLimitGuard } = await import('../src/common/guards/auth-rate-limit.guard.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
        id: res.body.data.user.id as string,
        token: res.body.data.access_token as string,
      };
    };

    const seller1 = await registerUser('SELLER', 'rental-seller1');
    seller1Id = seller1.id;
    seller1Token = seller1.token;

    const seller2 = await registerUser('SELLER', 'rental-seller2');
    seller2Token = seller2.token;

    const buyer = await registerUser('BUYER', 'rental-buyer');
    buyerToken = buyer.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `rental-admin-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin E2E RentalTest',
      },
    });
    createdUserIds.push(adminUser.id);

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);

    superadminToken = adminLoginRes.body.data.access_token;

    // Create test rental items for seller1
    const item1 = await prisma.rentalItem.create({
      data: {
        seller_id: seller1Id,
        name: 'Traktor Bajak Sawah A1',
        description: 'Traktor bertenaga diesel',
        available_units: 5,
        pricing_type: PricingType.per_day,
        price_per_day: 120000,
        price_per_hour: 20000,
      },
    });
    createdRentalItemIds.push(item1.id);
    testRentalItem1Id = item1.id;

    const item2 = await prisma.rentalItem.create({
      data: {
        seller_id: seller1Id,
        name: 'Mesin Pompa Air B2',
        description: 'Mesin pompa air irigasi',
        available_units: 10,
        pricing_type: PricingType.per_hour,
        price_per_hour: 15000,
      },
    });
    createdRentalItemIds.push(item2.id);
  }, 40000);

  afterAll(async () => {
    try {
      if (createdRentalItemIds.length > 0) {
        await prisma.orderItem.deleteMany({
          where: { rental_item_id: { in: createdRentalItemIds } },
        });
        await prisma.cartItem.deleteMany({
          where: { rental_item_id: { in: createdRentalItemIds } },
        });
        await prisma.rentalItem.deleteMany({
          where: { id: { in: createdRentalItemIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.order.deleteMany({
          where: { buyer_id: { in: createdUserIds } },
        });
        await prisma.cartItem.deleteMany({
          where: { cart: { buyer_id: { in: createdUserIds } } },
        });
        await prisma.cart.deleteMany({
          where: { buyer_id: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch {
      // Ignore cleanup errors
    } finally {
      await app?.close();
    }
  });

  describe('GET /api/rental/items (Public listing)', () => {
    it('successfully lists rental items without authentication (Public access)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items')
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'List of rental items',
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

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      const first = res.body.data.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('seller_id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('pricing_type');
      expect(first).toHaveProperty('available_units');
    });

    it('filters rental items by search keyword', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items?search=Traktor Bajak')
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((item: { name: string }) => {
        expect(item.name.toLowerCase()).toContain('traktor bajak');
      });
    });

    it('filters rental items by pricing_type (per_day)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items?pricing_type=per_day')
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((item: { pricing_type: string }) => {
        expect(item.pricing_type).toBe(PricingType.per_day);
      });
    });

    it('respects page and limit pagination query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items?page=1&limit=1')
        .expect(200);

      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
    });

    it('sorts rental items by name asc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items?sortBy=name&sortOrder=asc&limit=10')
        .expect(200);

      const names = res.body.data.data.map((i: { name: string }) => i.name.toLowerCase());
      for (let i = 0; i < names.length - 1; i++) {
        expect(names[i].localeCompare(names[i + 1])).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('GET /api/rental/items/{id} (Get rental item by ID)', () => {
    it('successfully retrieves rental item detail without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rental/items/${testRentalItem1Id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item detail',
        data: {
          id: testRentalItem1Id,
          seller_id: seller1Id,
          name: 'Traktor Bajak Sawah A1',
          available_units: 5,
          pricing_type: PricingType.per_day,
          price_per_day: 120000,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rental/items/invalid-uuid')
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent rental item ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rental/items/${randomUUID()}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });

  describe('POST /api/rental/items (Create rental item - SELLER only)', () => {
    it('rejects unauthenticated request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .send({
          name: 'Mesin Giling Padi',
          pricing_type: PricingType.per_day,
          available_units: 2,
        })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Mesin Giling Padi',
          pricing_type: PricingType.per_day,
          available_units: 2,
        })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects invalid payload with missing name or name < 3 chars (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          name: 'ab',
          pricing_type: PricingType.per_day,
          available_units: 1,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects invalid payload with negative available_units (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          name: 'Mesin Perontok Padi',
          pricing_type: PricingType.per_day,
          available_units: -1,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects invalid payload with invalid pricing_type (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          name: 'Mesin Perontok Padi',
          pricing_type: 'invalid_pricing_type',
          available_units: 2,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('successfully creates rental item with valid SELLER token (201 Created)', async () => {
      const payload = {
        name: 'Mesin Tanam Padi Modern',
        description: 'Alat tanam padi otomatis 4 baris',
        available_units: 3,
        pricing_type: PricingType.per_day,
        price_per_day: 250000,
        price_per_hour: 40000,
      };

      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item created',
        data: {
          id: expect.any(String),
          seller_id: seller1Id,
          name: payload.name,
          description: payload.description,
          available_units: payload.available_units,
          pricing_type: payload.pricing_type,
          price_per_day: payload.price_per_day,
          price_per_hour: payload.price_per_hour,
        },
      });

      createdRentalItemIds.push(res.body.data.id);

      // Verify DB persistence
      const dbItem = await prisma.rentalItem.findUnique({
        where: { id: res.body.data.id },
      });
      expect(dbItem).not.toBeNull();
      expect(dbItem?.seller_id).toBe(seller1Id);
      expect(dbItem?.name).toBe(payload.name);
    });

    it('successfully creates rental item with SUPERADMIN token (201 Created)', async () => {
      const payload = {
        name: 'Traktor Roda Empat Superadmin',
        description: 'Dibuat oleh admin',
        available_units: 2,
        pricing_type: PricingType.per_week,
        price_per_week: 1500000,
      };

      const res = await request(app.getHttpServer())
        .post('/api/rental/items')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item created',
        data: {
          id: expect.any(String),
          name: payload.name,
          pricing_type: PricingType.per_week,
          price_per_week: 1500000,
        },
      });

      createdRentalItemIds.push(res.body.data.id);
    });
  });

  describe('PUT /api/rental/items/{id} (Update rental item - SELLER owner only)', () => {
    let itemToUpdateId: string;

    beforeEach(async () => {
      const item = await prisma.rentalItem.create({
        data: {
          seller_id: seller1Id,
          name: `Rental Update Item ${Date.now()}`,
          available_units: 4,
          pricing_type: PricingType.per_day,
          price_per_day: 100000,
        },
      });
      createdRentalItemIds.push(item.id);
      itemToUpdateId = item.id;
    });

    it('rejects unauthenticated request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects non-owner Seller 2 from updating Seller 1 rental item (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ name: 'Hacked by Seller 2' })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/rental/items/invalid-uuid')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({ name: 'Valid Name' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent rental item ID', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${randomUUID()}`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({ name: 'Valid Name' })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects invalid payload with negative available_units (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({ available_units: -5 })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('successfully updates rental item by owner Seller 1 (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          name: 'Traktor Bajak Sawah Terupdate',
          available_units: 8,
          price_per_day: 135000,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item updated',
        data: {
          id: itemToUpdateId,
          name: 'Traktor Bajak Sawah Terupdate',
          available_units: 8,
          price_per_day: 135000,
        },
      });

      const dbItem = await prisma.rentalItem.findUnique({
        where: { id: itemToUpdateId },
      });
      expect(dbItem?.name).toBe('Traktor Bajak Sawah Terupdate');
      expect(dbItem?.available_units).toBe(8);
      expect(dbItem?.price_per_day).toBe(135000);
    });

    it('successfully updates rental item by SUPERADMIN (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/rental/items/${itemToUpdateId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          name: 'Updated by Superadmin',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item updated',
        data: {
          id: itemToUpdateId,
          name: 'Updated by Superadmin',
        },
      });
    });
  });

  describe('DELETE /api/rental/items/{id} (Delete rental item - SELLER owner only)', () => {
    let itemToDeleteId: string;

    beforeEach(async () => {
      const item = await prisma.rentalItem.create({
        data: {
          seller_id: seller1Id,
          name: `Rental Delete Item ${Date.now()}`,
          available_units: 2,
          pricing_type: PricingType.per_hour,
          price_per_hour: 25000,
        },
      });
      createdRentalItemIds.push(item.id);
      itemToDeleteId = item.id;
    });

    it('rejects unauthenticated request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${itemToDeleteId}`)
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects non-owner Seller 2 from deleting Seller 1 rental item (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/rental/items/invalid-uuid')
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent rental item ID', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${randomUUID()}`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully deletes rental item by owner Seller 1 (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${itemToDeleteId}`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item deleted',
        data: {
          message: 'Rental item deleted successfully',
        },
      });

      const dbItem = await prisma.rentalItem.findUnique({
        where: { id: itemToDeleteId },
      });
      expect(dbItem).toBeNull();
    });

    it('successfully deletes rental item by SUPERADMIN (200 OK)', async () => {
      // Create another item for seller1
      const item = await prisma.rentalItem.create({
        data: {
          seller_id: seller1Id,
          name: `Admin Deletable Item ${Date.now()}`,
          available_units: 1,
          pricing_type: PricingType.per_day,
          price_per_day: 50000,
        },
      });
      createdRentalItemIds.push(item.id);

      const res = await request(app.getHttpServer())
        .delete(`/api/rental/items/${item.id}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Rental item deleted',
        data: {
          message: 'Rental item deleted successfully',
        },
      });

      const dbItem = await prisma.rentalItem.findUnique({
        where: { id: item.id },
      });
      expect(dbItem).toBeNull();
    });
  });
});
