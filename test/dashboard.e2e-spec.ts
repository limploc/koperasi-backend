import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { OrderStatus, OrderType, ProductCategory, UserRole } from '@prisma/client';

describe('Dashboard E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  let seller1Token: string;
  let seller1Id: string;
  let seller2Token: string;
  let seller2Id: string;
  let buyerToken: string;
  let buyerId: string;
  let superadminToken: string;

  let productAId: string;
  let productBId: string;
  let productCId: string;
  let productDId: string;
  let productSeller2Id: string;

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

    const s1 = await registerUser('SELLER', 'dash-seller1');
    seller1Id = s1.id;
    seller1Token = s1.token;

    const s2 = await registerUser('SELLER', 'dash-seller2');
    seller2Id = s2.id;
    seller2Token = s2.token;

    const b = await registerUser('BUYER', 'dash-buyer');
    buyerId = b.id;
    buyerToken = b.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `dash-admin-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin E2E DashTest',
      },
    });
    createdUserIds.push(adminUser.id);

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);

    superadminToken = adminLoginRes.body.data.access_token;

    const createProduct = async (sellerId: string, name: string, price: number) => {
      const prod = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name,
          category: ProductCategory.kelapa,
          price,
          unit: 'kg',
          stock: 100,
        },
      });
      createdProductIds.push(prod.id);
      return prod.id;
    };

    productAId = await createProduct(seller1Id, 'Kelapa Super P1', 10000);
    productBId = await createProduct(seller1Id, 'Kelapa Hijau P2', 20000);
    productCId = await createProduct(seller1Id, 'Kelapa Parut P3', 30000);
    productDId = await createProduct(seller1Id, 'Kelapa Santan P4', 5000);
    productSeller2Id = await createProduct(seller2Id, 'Kelapa Seller2 PX', 50000);
  }, 40000);

  afterAll(async () => {
    try {
      if (createdOrderIds.length > 0) {
        await prisma.paymentTransaction.deleteMany({
          where: { order_id: { in: createdOrderIds } },
        });
        await prisma.orderItem.deleteMany({
          where: { order_id: { in: createdOrderIds } },
        });
        await prisma.order.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (createdProductIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { product_id: { in: createdProductIds } },
        });
        await prisma.product.deleteMany({
          where: { id: { in: createdProductIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { cart: { buyer_id: { in: createdUserIds } } },
        });
        await prisma.cart.deleteMany({
          where: { buyer_id: { in: createdUserIds } },
        });
        await prisma.order.deleteMany({
          where: { buyer_id: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch {
    } finally {
      await app?.close();
    }
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated request with 401 AUTH_REQUIRED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects invalid token with 401 AUTH_REQUIRED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role with 403 FORBIDDEN_ACCESS', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('permits SELLER role to access dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Dashboard analytics',
        data: expect.any(Object),
      });
    });

    it('permits SUPERADMIN role to access dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Dashboard analytics',
        data: expect.any(Object),
      });
    });
  });

  describe('Empty Data Scenario', () => {
    it('returns zeroed analytics for seller with no orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller2Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Dashboard analytics',
        data: {
          total_revenue: 0,
          total_orders: 0,
          total_items_sold: 0,
          average_order_value: 0,
          sales_last_7_days: expect.any(Array),
          top_3_best_selling_products: [],
        },
      });

      expect(res.body.data.sales_last_7_days).toHaveLength(7);
      res.body.data.sales_last_7_days.forEach((day: { revenue: number; orders_count: number }) => {
        expect(day.revenue).toBe(0);
        expect(day.orders_count).toBe(0);
      });
    });
  });

  describe('Populated Data & Calculations', () => {
    let pendingOrderId: string;

    beforeAll(async () => {
      const order1 = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 40000,
          status: OrderStatus.paid,
          order_type: OrderType.PRODUCT_PURCHASE,
          items: {
            create: [
              {
                product_id: productAId,
                quantity: 2,
                price: 10000,
                subtotal: 20000,
              },
              {
                product_id: productBId,
                quantity: 1,
                price: 20000,
                subtotal: 20000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order1.id);

      const order2 = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 30000,
          status: OrderStatus.paid,
          order_type: OrderType.PRODUCT_PURCHASE,
          items: {
            create: [
              {
                product_id: productCId,
                quantity: 1,
                price: 30000,
                subtotal: 30000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(order2.id);

      const orderPending = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 25000,
          status: OrderStatus.pending,
          order_type: OrderType.PRODUCT_PURCHASE,
          items: {
            create: [
              {
                product_id: productDId,
                quantity: 5,
                price: 5000,
                subtotal: 25000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(orderPending.id);
      pendingOrderId = orderPending.id;

      const orderFailed = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 30000,
          status: OrderStatus.failed,
          order_type: OrderType.PRODUCT_PURCHASE,
          items: {
            create: [
              {
                product_id: productAId,
                quantity: 3,
                price: 10000,
                subtotal: 30000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(orderFailed.id);

      const orderSeller2 = await prisma.order.create({
        data: {
          buyer_id: buyerId,
          total_amount: 50000,
          status: OrderStatus.paid,
          order_type: OrderType.PRODUCT_PURCHASE,
          items: {
            create: [
              {
                product_id: productSeller2Id,
                quantity: 1,
                price: 50000,
                subtotal: 50000,
              },
            ],
          },
        },
      });
      createdOrderIds.push(orderSeller2.id);
    });

    it('calculates totals, averages, and best sellers accurately for paid orders only', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Dashboard analytics',
        data: {
          total_revenue: 70000,
          total_orders: 2,
          total_items_sold: 4,
          average_order_value: 35000,
          sales_last_7_days: expect.any(Array),
          top_3_best_selling_products: expect.any(Array),
        },
      });

      expect(res.body.data.sales_last_7_days).toHaveLength(7);
      const today = new Date().toISOString().slice(0, 10);
      const todaySales = res.body.data.sales_last_7_days.find(
        (day: { date: string }) => day.date === today,
      );
      expect(todaySales).toBeDefined();
      expect(todaySales?.revenue).toBe(70000);
      expect(todaySales?.orders_count).toBe(2);

      const topProducts = res.body.data.top_3_best_selling_products;
      expect(topProducts).toHaveLength(3);
      expect(topProducts[0]).toMatchObject({
        product_id: productAId,
        name: 'Kelapa Super P1',
        total_sold: 2,
        revenue: 20000,
      });

      const topIds = topProducts.map((p: { product_id: string }) => p.product_id);
      expect(topIds).not.toContain(productDId);
      expect(topIds).not.toContain(productSeller2Id);
    });

    it('guarantees seller isolation so Seller 1 and Seller 2 metrics do not overlap', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller2Token}`)
        .expect(200);

      expect(res1.body.data.total_revenue).toBe(70000);
      expect(res2.body.data.total_revenue).toBe(50000);
      expect(res2.body.data.total_orders).toBe(1);
      expect(res2.body.data.total_items_sold).toBe(1);
      expect(res2.body.data.average_order_value).toBe(50000);
      expect(res2.body.data.top_3_best_selling_products).toHaveLength(1);
      expect(res2.body.data.top_3_best_selling_products[0].product_id).toBe(productSeller2Id);
    });

    it('reflects database status changes in real-time when pending order becomes paid', async () => {
      await prisma.order.update({
        where: { id: pendingOrderId },
        data: { status: OrderStatus.paid },
      });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/seller')
        .set('Authorization', `Bearer ${seller1Token}`)
        .expect(200);

      expect(res.body.data.total_revenue).toBe(95000);
      expect(res.body.data.total_orders).toBe(3);
      expect(res.body.data.total_items_sold).toBe(9);
      expect(res.body.data.average_order_value).toBe(Math.round(95000 / 3));

      const updatedTop = res.body.data.top_3_best_selling_products;
      expect(updatedTop[0].product_id).toBe(productDId);
      expect(updatedTop[0].total_sold).toBe(5);
    });
  });
});
