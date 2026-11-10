import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { OrderStatus, ProductCategory, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

describe('Admin E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  let superadminToken: string;
  let superadminId: string;
  let buyerToken: string;
  let buyerId: string;
  let sellerToken: string;
  let sellerId: string;

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
        email: payload.email,
        name: payload.name,
      };
    };

    const buyer = await registerUser('BUYER', 'admin-test-buyer');
    buyerId = buyer.id;
    buyerToken = buyer.token;

    const seller = await registerUser('SELLER', 'admin-test-seller');
    sellerId = seller.id;
    sellerToken = seller.token;

    // Create Superadmin user directly
    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `admin-test-sa-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin E2E AdminTest',
      },
    });
    createdUserIds.push(adminUser.id);
    superadminId = adminUser.id;

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);

    superadminToken = adminLoginRes.body.data.access_token;
  }, 40000);

  afterAll(async () => {
    try {
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
      }
      if (createdOrderIds.length > 0) {
        await prisma.order.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (createdProductIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { product_id: { in: createdProductIds } },
        });
        await prisma.orderItem.deleteMany({
          where: { product_id: { in: createdProductIds } },
        });
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
      // Ignore cleanup errors
    } finally {
      await app?.close();
    }
  });

  describe('Authorization: Superadmin role restriction across Admin endpoints', () => {
    it('rejects GET /api/admin/users without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects GET /api/admin/users for BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects GET /api/admin/users for SELLER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects GET /api/admin/orders for BUYER and SELLER roles (403 FORBIDDEN_ACCESS)', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });

    it('rejects DELETE /api/admin/products/{id} for BUYER and SELLER roles (403 FORBIDDEN_ACCESS)', async () => {
      const dummyId = randomUUID();
      await request(app.getHttpServer())
        .delete(`/api/admin/products/${dummyId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/admin/products/${dummyId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/users (List all users)', () => {
    it('successfully lists users for SUPERADMIN with pagination and no sensitive password exposed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'List of users',
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

      expect(res.body.data.data.length).toBeGreaterThan(0);
      const userItem = res.body.data.data[0];
      expect(userItem).toHaveProperty('id');
      expect(userItem).toHaveProperty('email');
      expect(userItem).toHaveProperty('role');
      expect(userItem).toHaveProperty('is_active');
      expect(userItem).not.toHaveProperty('password');
    });

    it('filters users by role (role=SELLER)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users?role=SELLER')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((u: { role: string }) => {
        expect(u.role).toBe(UserRole.SELLER);
      });
    });

    it('searches users by name or email query', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/users?search=admin-test-buyer`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      const found = res.body.data.data.some((u: { id: string }) => u.id === buyerId);
      expect(found).toBe(true);
    });
  });

  describe('GET /api/admin/users/{id} (Get user by ID)', () => {
    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent user ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully retrieves user detail for SUPERADMIN without exposing password', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/users/${buyerId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'User detail',
        data: {
          id: buyerId,
          role: UserRole.BUYER,
          is_active: true,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
      expect(res.body.data).not.toHaveProperty('password');
    });
  });

  describe('PUT /api/admin/users/{id} (Update user role/status)', () => {
    let targetUserId: string;

    beforeEach(async () => {
      // Create fresh user for update tests
      const argon2 = await import('argon2');
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const user = await prisma.user.create({
        data: {
          email: `target-${unique}@example.test`,
          phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          password: await argon2.hash('Password123!', { type: argon2.argon2id }),
          role: UserRole.BUYER,
          is_active: true,
          name: 'Target User',
        },
      });
      createdUserIds.push(user.id);
      targetUserId = user.id;
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID format', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ role: UserRole.SELLER })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND when updating nonexistent user', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ role: UserRole.SELLER })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects SUPERADMIN attempting to demote own account (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${superadminId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ role: UserRole.BUYER })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Cannot demote own SUPERADMIN account');
    });

    it('rejects SUPERADMIN attempting to deactivate own account (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${superadminId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ is_active: false })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Cannot deactivate own SUPERADMIN account');
    });

    it('successfully updates user role and status (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          role: UserRole.SELLER,
          is_active: false,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'User updated',
        data: {
          id: targetUserId,
          role: UserRole.SELLER,
          is_active: false,
        },
      });

      // Verify in DB
      const dbUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      expect(dbUser?.role).toBe(UserRole.SELLER);
      expect(dbUser?.is_active).toBe(false);
    });
  });

  describe('DELETE /api/admin/users/{id} (Deactivate user)', () => {
    let targetUserId: string;

    beforeEach(async () => {
      const argon2 = await import('argon2');
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const user = await prisma.user.create({
        data: {
          email: `deactivate-${unique}@example.test`,
          phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          password: await argon2.hash('Password123!', { type: argon2.argon2id }),
          role: UserRole.BUYER,
          is_active: true,
          name: 'Deactivate Target',
        },
      });
      createdUserIds.push(user.id);
      targetUserId = user.id;
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID format', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/admin/users/invalid-uuid')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND when deactivating nonexistent user', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects SUPERADMIN attempting to deactivate own account via DELETE (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/users/${superadminId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Cannot deactivate own SUPERADMIN account');
    });

    it('successfully deactivates user (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'User deactivated',
        data: {
          message: 'User deactivated successfully',
        },
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      expect(dbUser?.is_active).toBe(false);
    });
  });

  describe('GET /api/admin/orders (View all orders)', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Create a test product and order
      const prod = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: 'Admin Orders Test Product',
          category: ProductCategory.kelapa,
          price: 10000,
          unit: 'kg',
          stock: 20,
        },
      });
      createdProductIds.push(prod.id);

      const order = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 20000,
          status: OrderStatus.pending,
          items: {
            create: [
              {
                product_id: prod.id,
                quantity: 2,
                price: 10000,
                subtotal: 20000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order.id);
      testOrderId = order.id;
    });

    it('successfully retrieves all orders for SUPERADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'All orders',
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

      const found = res.body.data.data.some((o: { id: string }) => o.id === testOrderId);
      expect(found).toBe(true);
    });

    it('filters orders by buyer_id and status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/orders?buyer_id=${buyerId}&status=pending`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((o: { buyer_id: string; status: string }) => {
        expect(o.buyer_id).toBe(buyerId);
        expect(o.status).toBe(OrderStatus.pending);
      });
    });
  });

  describe('PUT /api/admin/orders/{id}/status (Update order status)', () => {
    let orderToUpdateId: string;
    let orderToFailId: string;
    let orderProduct: { id: string; stock: number };

    beforeEach(async () => {
      const prod = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: `Admin Order Status Prod ${Date.now()}`,
          category: ProductCategory.kelapa,
          price: 15000,
          unit: 'kg',
          stock: 10,
        },
      });
      createdProductIds.push(prod.id);
      orderProduct = prod;

      const order1 = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 15000,
          status: OrderStatus.pending,
          items: {
            create: [
              {
                product_id: prod.id,
                quantity: 1,
                price: 15000,
                subtotal: 15000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order1.id);
      orderToUpdateId = order1.id;

      const order2 = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 15000,
          status: OrderStatus.pending,
          items: {
            create: [
              {
                product_id: prod.id,
                quantity: 2,
                price: 15000,
                subtotal: 30000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order2.id);
      orderToFailId = order2.id;
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/admin/orders/invalid-uuid/status')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.paid })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent order ID', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/orders/${randomUUID()}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.paid })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully updates pending order status to paid (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/admin/orders/${orderToUpdateId}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.paid })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order status updated',
        data: {
          id: orderToUpdateId,
          status: OrderStatus.paid,
        },
      });

      const dbOrder = await prisma.order.findUnique({
        where: { id: orderToUpdateId },
      });
      expect(dbOrder?.status).toBe(OrderStatus.paid);
    });

    it('updating status to failed restores item stock (200 OK)', async () => {
      const beforeProduct = await prisma.product.findUnique({
        where: { id: orderProduct.id },
      });
      const stockBefore = beforeProduct!.stock;

      const res = await request(app.getHttpServer())
        .put(`/api/admin/orders/${orderToFailId}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.failed })
        .expect(200);

      expect(res.body.data.status).toBe(OrderStatus.failed);

      // Verify stock was incremented back by 2
      const afterProduct = await prisma.product.findUnique({
        where: { id: orderProduct.id },
      });
      expect(afterProduct?.stock).toBe(stockBefore + 2);
    });

    it('rejects updating an already failed order (400 VALIDATION_ERROR)', async () => {
      // First update to failed
      await request(app.getHttpServer())
        .put(`/api/admin/orders/${orderToFailId}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.failed })
        .expect(200);

      // Try updating again to paid
      const res = await request(app.getHttpServer())
        .put(`/api/admin/orders/${orderToFailId}/status`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ status: OrderStatus.paid })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Cannot update status of a failed order');
    });
  });

  describe('DELETE /api/admin/products/{id} (Delete any product)', () => {
    let productToDeleteId: string;

    beforeEach(async () => {
      const prod = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: `Admin Delete Test Product ${Date.now()}`,
          category: ProductCategory.kelapa,
          price: 25000,
          unit: 'kg',
          stock: 5,
        },
      });
      createdProductIds.push(prod.id);
      productToDeleteId = prod.id;
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/admin/products/invalid-uuid')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent product', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/products/${randomUUID()}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully deletes any product by SUPERADMIN (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/admin/products/${productToDeleteId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Product deleted',
        data: {
          message: 'Product deleted successfully',
        },
      });

      const dbProd = await prisma.product.findUnique({
        where: { id: productToDeleteId },
      });
      expect(dbProd).toBeNull();
    });
  });
});
