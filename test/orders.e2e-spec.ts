import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { OrderStatus, ProductCategory, PricingType, RentalDurationType, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

describe('Orders E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdRentalItemIds: string[] = [];

  let buyer1Token: string;
  let buyer1Id: string;
  let buyer2Token: string;
  let buyer2Id: string;
  let sellerToken: string;
  let sellerId: string;
  let superadminToken: string;

  let productAId: string;
  let productBId: string;
  let rentalItemId: string;

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

    const buyer1 = await registerUser('BUYER', 'order-buyer1');
    buyer1Id = buyer1.id;
    buyer1Token = buyer1.token;

    const buyer2 = await registerUser('BUYER', 'order-buyer2');
    buyer2Id = buyer2.id;
    buyer2Token = buyer2.token;

    const seller = await registerUser('SELLER', 'order-seller');
    sellerId = seller.id;
    sellerToken = seller.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `admin-order-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin Orders E2E',
      },
    });
    createdUserIds.push(adminUser.id);

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);

    superadminToken = adminLoginRes.body.data.access_token;

    // Create test products
    const productA = await prisma.product.create({
      data: {
        seller_id: sellerId,
        name: 'Orders E2E Product A',
        category: ProductCategory.kelapa,
        price: 20000,
        unit: 'kg',
        stock: 15,
        short_description: 'Product A for orders test',
      },
    });
    productAId = productA.id;
    createdProductIds.push(productA.id);

    const productB = await prisma.product.create({
      data: {
        seller_id: sellerId,
        name: 'Orders E2E Product B',
        category: ProductCategory.jagung,
        price: 30000,
        unit: 'kg',
        stock: 5,
        short_description: 'Product B for orders test',
      },
    });
    productBId = productB.id;
    createdProductIds.push(productB.id);

    // Create test rental item
    const rentalItem = await prisma.rentalItem.create({
      data: {
        seller_id: sellerId,
        name: 'Orders E2E Rental Item',
        description: 'Rental item for orders test',
        available_units: 4,
        pricing_type: PricingType.per_day,
        price_per_day: 75000,
      },
    });
    rentalItemId = rentalItem.id;
    createdRentalItemIds.push(rentalItem.id);
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
      if (createdProductIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { product_id: { in: createdProductIds } },
        });
        await prisma.product.deleteMany({
          where: { id: { in: createdProductIds } },
        });
      }
      if (createdRentalItemIds.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { rental_item_id: { in: createdRentalItemIds } },
        });
        await prisma.rentalItem.deleteMany({
          where: { id: { in: createdRentalItemIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    await app?.close();
  });

  describe('Authentication & Authorization for Orders Endpoints', () => {
    it('rejects POST /api/ecommerce/orders without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
        meta: { timestamp: expect.any(String) },
      });
    });

    it('rejects GET /api/ecommerce/orders without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects GET /api/ecommerce/orders/{id} without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${randomUUID()}`)
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects POST /api/ecommerce/orders/{id}/pay without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${randomUUID()}/pay`)
        .send({ simulate: 'success' })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects SELLER role from POST /api/ecommerce/orders (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from GET /api/ecommerce/orders (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from GET /api/ecommerce/orders/{id} (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${randomUUID()}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from POST /api/ecommerce/orders/{id}/pay (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${randomUUID()}/pay`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ simulate: 'success' })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });
  });

  describe('POST /api/ecommerce/orders (Checkout)', () => {
    it('rejects checkout when buyer cart is empty (400 VALIDATION_ERROR)', async () => {
      // Ensure buyer1 cart is empty first
      await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('successfully checks out a cart with product items (201 Created)', async () => {
      // Add Product A (quantity 2, price 20000) to buyer1 cart
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ product_id: productAId, quantity: 2 })
        .expect(201);

      const initialProduct = await prisma.product.findUnique({
        where: { id: productAId },
      });
      const initialStock = initialProduct!.stock;

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order created',
        data: {
          id: expect.any(String),
          buyer_id: buyer1Id,
          total_amount: 40000,
          status: 'pending',
          order_type: 'PRODUCT_PURCHASE',
          items: [
            {
              product_id: productAId,
              quantity: 2,
              price: 20000,
              subtotal: 40000,
              rental_item_id: null,
              duration_type: null,
              item_type: 'product',
              product: {
                id: productAId,
                name: 'Orders E2E Product A',
                price: 20000,
              },
            },
          ],
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });

      expect(res.body.data.id).toEqual(expect.any(String));

      // Verify stock was decremented
      const updatedProduct = await prisma.product.findUnique({
        where: { id: productAId },
      });
      expect(updatedProduct?.stock).toBe(initialStock - 2);

      // Verify cart was cleared
      const cartRes = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(cartRes.body.data.items).toEqual([]);
      expect(cartRes.body.data.total_amount).toBe(0);
      expect(cartRes.body.data.total_items).toBe(0);
    });

    it('successfully checks out a cart with rental items (EQUIPMENT_RENTAL type)', async () => {
      // Add Rental Item (quantity 1, price 75000/day) to buyer1 cart
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({
          rental_item_id: rentalItemId,
          quantity: 1,
          duration_type: RentalDurationType.day,
          item_type: 'rental',
        })
        .expect(201);

      const initialRental = await prisma.rentalItem.findUnique({
        where: { id: rentalItemId },
      });
      const initialUnits = initialRental!.available_units;

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order created',
        data: {
          id: expect.any(String),
          buyer_id: buyer1Id,
          total_amount: 75000,
          status: 'pending',
          order_type: 'EQUIPMENT_RENTAL',
          items: [
            expect.objectContaining({
              rental_item_id: rentalItemId,
              quantity: 1,
              price: 75000,
              subtotal: 75000,
              duration_type: 'day',
              item_type: 'rental',
            }),
          ],
        },
      });

      // Verify rental available_units was decremented
      const updatedRental = await prisma.rentalItem.findUnique({
        where: { id: rentalItemId },
      });
      expect(updatedRental?.available_units).toBe(initialUnits - 1);
    });

    it('rejects checkout when product stock becomes insufficient before checkout (400 VALIDATION_ERROR)', async () => {
      // Add Product B (quantity 3) to buyer1 cart (stock is currently 5)
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ product_id: productBId, quantity: 3 })
        .expect(201);

      // Artificially reduce stock in database to 1
      await prisma.product.update({
        where: { id: productBId },
        data: { stock: 1 },
      });

      // Attempt checkout
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });

      // Restore stock for further tests
      await prisma.product.update({
        where: { id: productBId },
        data: { stock: 5 },
      });

      // Clear buyer1 cart
      await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);
    });
  });

  describe('GET /api/ecommerce/orders (Buyer Order History)', () => {
    let paidOrderId: string;

    beforeAll(async () => {
      // Create Order 1 for buyer1 (pending)
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ product_id: productAId, quantity: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(201);

      // Create Order 2 for buyer1 and pay it
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ product_id: productAId, quantity: 1 })
        .expect(201);

      const o2Res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(201);
      paidOrderId = o2Res.body.data.id;

      await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${paidOrderId}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(200);

      // Create Order for buyer2 to verify isolation
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .send({ product_id: productAId, quantity: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(201);
    });

    it('retrieves order history for authenticated buyer with pagination metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order history',
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

      // Verify all orders in buyer1 history belong to buyer1
      res.body.data.data.forEach((order: { buyer_id: string }) => {
        expect(order.buyer_id).toBe(buyer1Id);
      });
    });

    it('respects page and limit pagination query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
      expect(res.body.data.meta.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('filters orders by status=pending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders?status=pending')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((order: { status: string }) => {
        expect(order.status).toBe('pending');
      });
    });

    it('filters orders by status=paid', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders?status=paid')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((order: { status: string }) => {
        expect(order.status).toBe('paid');
      });
    });

    it('rejects invalid status filter parameter (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders?status=invalid_status')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('ensures Buyer 2 cannot see Buyer 1 orders in history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(200);

      res.body.data.data.forEach((order: { buyer_id: string }) => {
        expect(order.buyer_id).toBe(buyer2Id);
        expect(order.buyer_id).not.toBe(buyer1Id);
      });
    });
  });

  describe('GET /api/ecommerce/orders/{id} (Order Detail)', () => {
    let buyer1OrderId: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ product_id: productAId, quantity: 1 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(201);

      buyer1OrderId = res.body.data.id;
    });

    it('retrieves order details for the owner buyer (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${buyer1OrderId}`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order detail',
        data: {
          id: buyer1OrderId,
          buyer_id: buyer1Id,
          total_amount: expect.any(Number),
          status: 'pending',
          items: expect.any(Array),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
    });

    it('rejects non-UUID format ID (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/orders/not-a-valid-uuid')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent order ID', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects Buyer 2 from accessing Buyer 1 order (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${buyer1OrderId}`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('allows SUPERADMIN to view Buyer 1 order detail (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ecommerce/orders/${buyer1OrderId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Order detail',
        data: {
          id: buyer1OrderId,
          buyer_id: buyer1Id,
        },
      });
    });
  });

  describe('POST /api/ecommerce/orders/{id}/pay (Payment Simulation)', () => {
    const createPendingOrder = async (token: string, quantity = 1) => {
      const prod = await prisma.product.create({
        data: {
          seller_id: sellerId,
          name: `Pay Test Prod ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: ProductCategory.kelapa,
          price: 25000,
          unit: 'kg',
          stock: 50,
        },
      });
      createdProductIds.push(prod.id);

      await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ product_id: prod.id, quantity })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      return { order: res.body.data, product: prod };
    };

    it('rejects non-UUID ID parameter (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/orders/not-a-uuid/pay')
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND when paying nonexistent order', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${nonExistentId}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects Buyer 2 attempting to pay Buyer 1 order (403 FORBIDDEN_ACCESS)', async () => {
      const { order } = await createPendingOrder(buyer1Token);
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .send({ simulate: 'success' })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects invalid simulate payload value (400 VALIDATION_ERROR)', async () => {
      const { order } = await createPendingOrder(buyer1Token);
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'unknown_option' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('successfully processes payment with simulate=success (200 OK, status=paid)', async () => {
      const { order } = await createPendingOrder(buyer1Token);
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Payment processed',
        data: {
          id: order.id,
          status: 'paid',
        },
      });

      // Verify status in DB
      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(dbOrder?.status).toBe(OrderStatus.paid);
    });

    it('successfully processes payment with default empty body (defaults to success)', async () => {
      const { order } = await createPendingOrder(buyer1Token);
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({})
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Payment processed',
        data: {
          id: order.id,
          status: 'paid',
        },
      });

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(dbOrder?.status).toBe(OrderStatus.paid);
    });

    it('rejects payment on an already paid order (400 VALIDATION_ERROR)', async () => {
      const { order } = await createPendingOrder(buyer1Token);
      // First pay the order
      await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(200);

      // Attempt to pay again
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Order not in pending status');
    });

    it('successfully handles simulate=failure and restores product stock (200 OK, status=failed)', async () => {
      const { order, product } = await createPendingOrder(buyer1Token, 2);

      const stockBeforeFailure = (await prisma.product.findUnique({
        where: { id: product.id },
      }))!.stock;

      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'failure' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Payment processed',
        data: {
          id: order.id,
          status: 'failed',
        },
      });

      // Verify status in DB is failed
      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(dbOrder?.status).toBe(OrderStatus.failed);

      // Verify stock was restored (+2)
      const afterProduct = await prisma.product.findUnique({
        where: { id: product.id },
      });
      expect(afterProduct?.stock).toBe(stockBeforeFailure + 2);
    });

    it('rejects payment on an already failed order (400 VALIDATION_ERROR)', async () => {
      const { order } = await createPendingOrder(buyer1Token);

      // First fail the order
      await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'failure' })
        .expect(200);

      // Attempt to pay again
      const res = await request(app.getHttpServer())
        .post(`/api/ecommerce/orders/${order.id}/pay`)
        .set('Authorization', `Bearer ${buyer1Token}`)
        .send({ simulate: 'success' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(res.body.message).toContain('Order not in pending status');
    });
  });
});
