import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { vi } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { MidtransService } from '../src/payments/midtrans/midtrans.service.js';
import { OrderStatus, OrderType, PaymentProvider, PaymentTransactionStatus, ProductCategory, UserRole } from '@prisma/client';

describe('Payments E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let midtransService: MidtransService;

  const testServerKey = 'test-midtrans-server-key-e2e-98765';

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];

  let sellerToken: string;
  let buyerToken: string;
  let buyerId: string;
  let otherBuyerId: string;

  let testProduct: { id: string; price: number; stock: number };

  const computeSignature = (orderId: string, statusCode: string | undefined, grossAmount: string | number) => {
    const rawAmount = String(grossAmount);
    const code = statusCode ?? '200';
    return crypto.createHash('sha512').update(`${orderId}${code}${rawAmount}${testServerKey}`).digest('hex');
  };

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
    process.env.MIDTRANS_SERVER_KEY = testServerKey;

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

    prisma = app.get(PrismaService);
    midtransService = app.get(MidtransService);

    vi.spyOn(midtransService, 'createSnapTransaction').mockImplementation(async (params) => {
      return {
        token: `snap-token-${params.orderId}`,
        redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-${params.orderId}`,
      };
    });

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

    const seller = await registerUser(UserRole.SELLER, 'pay-seller');
    sellerToken = seller.token;

    const buyer = await registerUser(UserRole.BUYER, 'pay-buyer');
    buyerToken = buyer.token;
    buyerId = buyer.id;

    const otherBuyer = await registerUser(UserRole.BUYER, 'pay-otherbuyer');
    otherBuyerId = otherBuyer.id;

    const suffix = Date.now().toString().slice(-6);
    const prod = await prisma.product.create({
      data: {
        seller_id: seller.id,
        name: `Product Pay ${suffix}`,
        short_description: 'Test product for payments',
        price: 50000,
        unit: 'kg',
        stock: 20,
        category: ProductCategory.kelapa,
      },
    });
    testProduct = { id: prod.id, price: prod.price, stock: prod.stock };
    createdProductIds.push(prod.id);
  });

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
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  const createPendingOrder = async (ownerBuyerId: string, quantity = 2) => {
    const totalAmount = testProduct.price * quantity;
    const order = await prisma.order.create({
      data: {
        buyer_id: ownerBuyerId,
        total_amount: totalAmount,
        status: OrderStatus.pending,
        order_type: OrderType.PRODUCT_PURCHASE,
        items: {
          create: {
            product_id: testProduct.id,
            price: testProduct.price,
            quantity,
            subtotal: totalAmount,
          },
        },
      },
      include: {
        items: true,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  };

  describe('POST /api/payments/midtrans/create', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .send({
          order_id: '00000000-0000-0000-0000-000000000000',
          gross_amount: 100000,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('AUTH_REQUIRED');
    });

    it('should reject request from SELLER role with 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          order_id: '00000000-0000-0000-0000-000000000000',
          gross_amount: 100000,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('FORBIDDEN_ACCESS');
    });

    it('should reject invalid payload with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: '',
          gross_amount: -500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject when order does not exist with 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: '11111111-2222-3333-4444-555555555555',
          gross_amount: 100000,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should reject when order belongs to a different buyer with 403', async () => {
      const otherOrder = await createPendingOrder(otherBuyerId, 1);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: otherOrder.id,
          gross_amount: otherOrder.total_amount,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('FORBIDDEN_ACCESS');
    });

    it('should reject when gross_amount does not match order total with 400', async () => {
      const order = await createPendingOrder(buyerId, 2);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount + 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject payment creation when order is not pending with 400', async () => {
      const order = await createPendingOrder(buyerId, 1);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.paid },
      });

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully create Snap transaction and persist payment transaction', async () => {
      const order = await createPendingOrder(buyerId, 2);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Payment transaction created');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.order_id).toBe(order.id);
      expect(res.body.data.snap_token).toBe(`snap-token-${order.id}`);
      expect(res.body.data.redirect_url).toContain(`snap-token-${order.id}`);

      const savedTransaction = await prisma.paymentTransaction.findFirst({
        where: { order_id: order.id, provider: PaymentProvider.MIDTRANS },
      });
      expect(savedTransaction).not.toBeNull();
      expect(savedTransaction?.transaction_status).toBe(PaymentTransactionStatus.pending);
      expect(savedTransaction?.gross_amount).toBe(order.total_amount);
      expect(savedTransaction?.snap_token).toBe(res.body.data.snap_token);
      expect(savedTransaction?.redirect_url).toBe(res.body.data.redirect_url);
    });

    it('should return existing pending transaction idempotently without recreating', async () => {
      const order = await createPendingOrder(buyerId, 1);

      const resFirst = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount,
        });

      expect(resFirst.status).toBe(200);

      const snapSpy = vi.spyOn(midtransService, 'createSnapTransaction');
      snapSpy.mockClear();

      const resSecond = await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount,
        });

      expect(resSecond.status).toBe(200);
      expect(resSecond.body.data.snap_token).toBe(resFirst.body.data.snap_token);
      expect(resSecond.body.data.redirect_url).toBe(resFirst.body.data.redirect_url);
      expect(snapSpy).not.toHaveBeenCalled();

      const count = await prisma.paymentTransaction.count({
        where: { order_id: order.id },
      });
      expect(count).toBe(1);
    });
  });

  describe('POST /api/payments/midtrans/webhook', () => {
    it('should be publicly accessible without authorization header', async () => {
      const invalidSignaturePayload = {
        order_id: '00000000-0000-0000-0000-000000000000',
        transaction_status: 'settlement',
        gross_amount: 100000,
        signature_key: 'invalid-signature-key-public-test',
      };

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send(invalidSignaturePayload);

      expect(res.status).not.toBe(401);
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject webhook with invalid signature key with 400', async () => {
      const order = await createPendingOrder(buyerId, 1);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          transaction_status: 'settlement',
          gross_amount: order.total_amount,
          signature_key: 'completely-invalid-hash',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid signature');
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject webhook for non-existent order with 404', async () => {
      const nonExistentOrderId = '99999999-8888-7777-6666-555555555555';
      const signature = computeSignature(nonExistentOrderId, '200', 100000);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: nonExistentOrderId,
          status_code: '200',
          transaction_status: 'settlement',
          gross_amount: 100000,
          signature_key: signature,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should reject webhook with mismatched gross_amount with 400', async () => {
      const order = await createPendingOrder(buyerId, 1);
      const wrongAmount = order.total_amount + 9999;
      const signature = computeSignature(order.id, '200', wrongAmount);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'settlement',
          gross_amount: wrongAmount,
          signature_key: signature,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject webhook with unsupported transaction status with 400', async () => {
      const order = await createPendingOrder(buyerId, 1);
      const signature = computeSignature(order.id, '200', order.total_amount);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'chargeback',
          gross_amount: order.total_amount,
          signature_key: signature,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should process settlement and transition order to paid', async () => {
      const order = await createPendingOrder(buyerId, 2);

      await request(app.getHttpServer())
        .post('/api/payments/midtrans/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          order_id: order.id,
          gross_amount: order.total_amount,
        });

      const signature = computeSignature(order.id, '200', order.total_amount);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'settlement',
          payment_type: 'bank_transfer',
          gross_amount: order.total_amount,
          signature_key: signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Webhook processed');

      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.paid);

      const updatedTransaction = await prisma.paymentTransaction.findFirst({
        where: { order_id: order.id },
      });
      expect(updatedTransaction?.transaction_status).toBe(PaymentTransactionStatus.settlement);
      expect(updatedTransaction?.payment_type).toBe('bank_transfer');
    });

    it('should handle duplicate settlement idempotently without error', async () => {
      const order = await createPendingOrder(buyerId, 1);
      const signature = computeSignature(order.id, '200', order.total_amount);

      const firstRes = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'settlement',
          gross_amount: order.total_amount,
          signature_key: signature,
        });
      expect(firstRes.status).toBe(200);

      const secondRes = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'settlement',
          gross_amount: order.total_amount,
          signature_key: signature,
        });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.success).toBe(true);

      const currentOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(currentOrder?.status).toBe(OrderStatus.paid);
    });

    it('should process cancel/expire/deny, transition order to failed, and restore stock', async () => {
      const initialProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      const stockBefore = initialProduct?.stock ?? 20;

      const orderQuantity = 3;
      const order = await createPendingOrder(buyerId, orderQuantity);

      await prisma.product.update({
        where: { id: testProduct.id },
        data: { stock: { decrement: orderQuantity } },
      });

      const signature = computeSignature(order.id, '200', order.total_amount);

      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'cancel',
          gross_amount: order.total_amount,
          signature_key: signature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const failedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(failedOrder?.status).toBe(OrderStatus.failed);

      const restoredProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
      });
      expect(restoredProduct?.stock).toBe(stockBefore);
    });

    it('should not revert failed order to pending on subsequent pending webhook', async () => {
      const order = await createPendingOrder(buyerId, 1);
      const cancelSig = computeSignature(order.id, '200', order.total_amount);

      await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'cancel',
          gross_amount: order.total_amount,
          signature_key: cancelSig,
        });

      const pendingSig = computeSignature(order.id, '200', order.total_amount);
      const res = await request(app.getHttpServer())
        .post('/api/payments/midtrans/webhook')
        .send({
          order_id: order.id,
          status_code: '200',
          transaction_status: 'pending',
          gross_amount: order.total_amount,
          signature_key: pendingSig,
        });

      expect(res.status).toBe(200);

      const finalOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(finalOrder?.status).toBe(OrderStatus.failed);
    });
  });
});
