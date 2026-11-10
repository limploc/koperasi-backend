import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

describe('Users E2E (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cloudinaryService: CloudinaryService;

  const createdUserIds: string[] = [];

  let superadminToken: string;
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

    const buyer = await registerUser('BUYER', 'users-test-buyer');
    buyerId = buyer.id;
    buyerToken = buyer.token;

    const seller = await registerUser('SELLER', 'users-test-seller');
    sellerId = seller.id;
    sellerToken = seller.token;

    const adminUnique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adminEmail = `users-test-sa-${adminUnique}@example.test`;
    const argon2 = await import('argon2');
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        phone_number: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        password: await argon2.hash('AdminPass123!', { type: argon2.argon2id }),
        role: UserRole.SUPERADMIN,
        name: 'Super Admin E2E UsersTest',
      },
    });
    createdUserIds.push(adminUser.id);

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

  describe('GET /api/users (List users - SUPERADMIN only)', () => {
    it('rejects unauthenticated request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects invalid token (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('successfully lists users for SUPERADMIN with pagination and no passwords exposed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'List of users',
        data: {
          data: expect.any(Array),
          meta: {
            page: 1,
            limit: 20,
            total: expect.any(Number),
            totalPages: expect.any(Number),
          },
        },
      });

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((u: { id: string; password?: string }) => {
        expect(u).toHaveProperty('id');
        expect(u).not.toHaveProperty('password');
      });
    });

    it('filters users by role (role=BUYER)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users?role=BUYER')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      res.body.data.data.forEach((u: { role: string }) => {
        expect(u.role).toBe(UserRole.BUYER);
      });
    });

    it('respects page and limit pagination query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users?page=1&limit=2')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.limit).toBe(2);
    });

    it('filters users by search substring', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users?search=users-test-seller')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBeGreaterThan(0);
      const found = res.body.data.data.some((u: { id: string }) => u.id === sellerId);
      expect(found).toBe(true);
    });
  });

  describe('GET /api/users/{id} (Get user by ID - SUPERADMIN only)', () => {
    it('rejects unauthenticated request (401 AUTH_REQUIRED)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${buyerId}`)
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'AUTH_REQUIRED' },
      });
    });

    it('rejects BUYER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${buyerId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('rejects SELLER role (403 FORBIDDEN_ACCESS)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${buyerId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN_ACCESS' },
      });
    });

    it('returns 400 VALIDATION_ERROR for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/not-a-valid-uuid')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND for nonexistent user ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${randomUUID()}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('successfully retrieves user detail for SUPERADMIN without exposing password', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${sellerId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'User detail',
        data: {
          id: sellerId,
          role: UserRole.SELLER,
          is_active: true,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
      expect(res.body.data).not.toHaveProperty('password');
    });
  });
});
