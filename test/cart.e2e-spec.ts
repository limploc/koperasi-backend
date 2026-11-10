import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { ProductCategory, PricingType, RentalDurationType, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

describe('Cart E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdRentalItemIds: string[] = [];

  let buyerToken: string;
  let buyerId: string;
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

    const buyer1 = await registerUser('BUYER', 'cart-buyer1');
    buyerId = buyer1.id;
    buyerToken = buyer1.token;

    const buyer2 = await registerUser('BUYER', 'cart-buyer2');
    buyer2Id = buyer2.id;
    buyer2Token = buyer2.token;

    const seller = await registerUser('SELLER', 'cart-seller');
    sellerId = seller.id;
    sellerToken = seller.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `admin-cart-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin Cart E2E',
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
        name: 'Cart E2E Product A',
        category: ProductCategory.kelapa,
        price: 15000,
        unit: 'kg',
        stock: 10,
        short_description: 'Product A description',
      },
    });
    productAId = productA.id;
    createdProductIds.push(productA.id);

    const productB = await prisma.product.create({
      data: {
        seller_id: sellerId,
        name: 'Cart E2E Product B (Low Stock)',
        category: ProductCategory.jagung,
        price: 25000,
        unit: 'kg',
        stock: 2,
        short_description: 'Product B description',
      },
    });
    productBId = productB.id;
    createdProductIds.push(productB.id);

    // Create test rental item
    const rentalItem = await prisma.rentalItem.create({
      data: {
        seller_id: sellerId,
        name: 'Cart E2E Rental Item',
        description: 'Rental item description',
        available_units: 3,
        pricing_type: PricingType.per_day,
        price_per_day: 50000,
        price_per_hour: 10000,
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
      // Ignore errors during cleanup
    }

    await app?.close();
  });

  describe('Authentication & Authorization for Cart Endpoints', () => {
    it('rejects GET /api/ecommerce/cart without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
        meta: { timestamp: expect.any(String) },
      });
    });

    it('rejects GET /api/ecommerce/cart with invalid token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects POST /api/ecommerce/cart/items without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .send({ product_id: productAId, quantity: 1 })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects PUT /api/ecommerce/cart/items/{productId} without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .send({ quantity: 2 })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects DELETE /api/ecommerce/cart/items/{productId} without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/cart/items/${productAId}`)
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects DELETE /api/ecommerce/cart without token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects SELLER role from GET /api/ecommerce/cart (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from POST /api/ecommerce/cart/items (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ product_id: productAId, quantity: 1 })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from PUT /api/ecommerce/cart/items/{productId} (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ quantity: 2 })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from DELETE /api/ecommerce/cart/items/{productId} (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role from DELETE /api/ecommerce/cart (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('allows SUPERADMIN role to access GET /api/ecommerce/cart', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Current cart',
        data: {
          items: expect.any(Array),
        },
      });
    });
  });

  describe('GET /api/ecommerce/cart', () => {
    it('retrieves an empty cart for a new buyer', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Current cart',
        data: {
          id: expect.any(String),
          buyer_id: buyerId,
          items: [],
          total_amount: 0,
          total_items: 0,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
    });
  });

  describe('POST /api/ecommerce/cart/items (Add to Cart)', () => {
    it('adds a new product item to cart (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productAId,
          quantity: 2,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Item added to cart (created)',
        data: {
          buyer_id: buyerId,
          total_amount: 30000,
          total_items: 1,
          items: [
            {
              product_id: productAId,
              quantity: 2,
              price_snapshot: 15000,
              subtotal: 30000,
              rental_item_id: null,
              duration_type: null,
              item_type: 'product',
              product: {
                id: productAId,
                name: 'Cart E2E Product A',
                price: 15000,
              },
            },
          ],
        },
      });
    });

    it('increments quantity when adding the same product again (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productAId,
          quantity: 3,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Item added to cart',
        data: {
          total_amount: 75000, // 5 * 15000
          total_items: 1,
          items: [
            {
              product_id: productAId,
              quantity: 5,
              price_snapshot: 15000,
              subtotal: 75000,
            },
          ],
        },
      });
    });

    it('adds a rental item to cart with duration_type (201 Created)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rental_item_id: rentalItemId,
          quantity: 1,
          duration_type: RentalDurationType.day,
          item_type: 'rental',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Item added to cart (created)',
        data: {
          total_items: 2,
          total_amount: 125000, // 75000 + 50000
          items: expect.arrayContaining([
            expect.objectContaining({
              rental_item_id: rentalItemId,
              quantity: 1,
              price_snapshot: 50000,
              subtotal: 50000,
              duration_type: 'day',
              item_type: 'rental',
            }),
          ]),
        },
      });
    });

    it('rejects payload when neither product_id nor rental_item_id is provided (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 1 })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('rejects payload when both product_id and rental_item_id are provided (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productAId,
          rental_item_id: rentalItemId,
          quantity: 1,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('rejects invalid product_id UUID format (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: 'not-a-valid-uuid',
          quantity: 1,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects quantity less than 1 (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productAId,
          quantity: 0,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects nonexistent product_id (404 RESOURCE_NOT_FOUND)', async () => {
      const nonexistentId = randomUUID();
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: nonexistentId,
          quantity: 1,
        })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects nonexistent rental_item_id (404 RESOURCE_NOT_FOUND)', async () => {
      const nonexistentId = randomUUID();
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rental_item_id: nonexistentId,
          quantity: 1,
          duration_type: 'day',
        })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects adding quantity that exceeds product stock (400 VALIDATION_ERROR)', async () => {
      // Product B has stock of 2
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productBId,
          quantity: 10,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects cumulative quantity that exceeds product stock (400 VALIDATION_ERROR)', async () => {
      // Product A stock is 10, current cart has 5 items. Adding 6 more exceeds 10.
      const res = await request(app.getHttpServer())
        .post('/api/ecommerce/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          product_id: productAId,
          quantity: 6,
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });
  });

  describe('PUT /api/ecommerce/cart/items/{productId} (Update Cart Item Quantity)', () => {
    it('successfully updates an existing cart item quantity (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Cart item updated',
        data: {
          total_items: 2,
          total_amount: 95000, // (3 * 15000) + 50000
          items: expect.arrayContaining([
            expect.objectContaining({
              product_id: productAId,
              quantity: 3,
              subtotal: 45000,
            }),
          ]),
        },
      });
    });

    it('rejects non-UUID productId in path (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/ecommerce/cart/items/invalid-uuid')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 2 })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects invalid quantity <= 0 (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 0 })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects quantity exceeding available stock (400 VALIDATION_ERROR)', async () => {
      // Product A stock is 10
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 15 })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects updating an item not in current buyer cart (404 RESOURCE_NOT_FOUND)', async () => {
      // Product B has not been added to buyer cart
      const res = await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productBId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 1 })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });

  describe('Cart Ownership and Multi-Buyer Isolation', () => {
    it('verifies Buyer 2 cannot see or modify Buyer 1 items', async () => {
      // Buyer 2 cart should be empty
      const b2CartRes = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(200);

      expect(b2CartRes.body.data.buyer_id).toBe(buyer2Id);
      expect(b2CartRes.body.data.items).toHaveLength(0);
      expect(b2CartRes.body.data.total_amount).toBe(0);

      // Buyer 2 cannot update Product A (which is only in Buyer 1 cart)
      await request(app.getHttpServer())
        .put(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .send({ quantity: 1 })
        .expect(404);

      // Buyer 2 cannot remove Product A
      await request(app.getHttpServer())
        .delete(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(404);
    });
  });

  describe('DELETE /api/ecommerce/cart/items/{productId} (Remove Item)', () => {
    it('rejects non-UUID path parameter (400 VALIDATION_ERROR)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/ecommerce/cart/items/invalid-uuid')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects removing nonexistent or not-in-cart item (404 RESOURCE_NOT_FOUND)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/cart/items/${productBId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully removes a product item from cart (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/ecommerce/cart/items/${productAId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Item removed',
        data: {
          total_items: 1, // rental item remains
          total_amount: 50000,
        },
      });

      const hasProductA = res.body.data.items.some(
        (i: { product_id: string }) => i.product_id === productAId,
      );
      expect(hasProductA).toBe(false);
    });
  });

  describe('DELETE /api/ecommerce/cart (Clear Cart)', () => {
    it('successfully clears all items from buyer cart (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Cart cleared',
        data: {
          id: expect.any(String),
          buyer_id: buyerId,
          items: [],
          total_amount: 0,
          total_items: 0,
        },
      });

      // Verify cart is indeed empty via GET
      const getRes = await request(app.getHttpServer())
        .get('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(getRes.body.data.items).toEqual([]);
      expect(getRes.body.data.total_amount).toBe(0);
      expect(getRes.body.data.total_items).toBe(0);
    });

    it('clearing an already empty cart succeeds idempotently (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/ecommerce/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Cart cleared',
        data: {
          items: [],
          total_amount: 0,
          total_items: 0,
        },
      });
    });
  });
});
