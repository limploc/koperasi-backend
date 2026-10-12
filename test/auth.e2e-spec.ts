import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';

const hasIsolatedInfrastructure = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!hasIsolatedInfrastructure)('Authentication (real integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let userId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.REDIS_URL;
    if (!databaseUrl || !redisUrl) {
      throw new Error('Refusing to run E2E tests: set DATABASE_URL and REDIS_URL for isolated services.');
    }

    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.JWT_ACCESS_SECRET = 'e2e-only-access-secret-change-me';
    process.env.JWT_REFRESH_SECRET = 'e2e-only-refresh-secret-change-me';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const { AppModule } = await import('../src/app.module.js');
    const { ApiExceptionFilter } = await import('../src/common/filters/api-exception.filter.js');
    const { ValidationPipe } = await import('@nestjs/common');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  }, 30000);

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app?.close();
  });

  it('registers, persists a hashed password, logs in, and reads the current user', async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const registration = {
      email: `e2e-${unique}@example.test`,
      phone_number: `08${unique.replace(/\D/g, '').slice(-10)}`,
      password: 'SecurePass123!',
      role: 'BUYER',
      name: 'E2E Buyer',
    };

  
    const registered = await request(app.getHttpServer()).post('/api/auth/register').send(registration).expect(201);
    expect(registered.body).toMatchObject({
      success: true,
      data: { access_token: expect.any(String), refresh_token: expect.any(String), user: { email: registration.email, role: 'BUYER' } },
    });
    userId = registered.body.data.user.id;

    const saved = await prisma.user.findUnique({ where: { id: userId } });
    expect(saved?.password).not.toBe(registration.password);
    expect(saved?.password).toMatch(/^\$argon2id\$/);

  
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: registration.email, password: registration.password }).expect(200);
    expect(login.body.data.refresh_token).toEqual(expect.any(String));

    const sessionKeys = await redis.getClient().keys('auth:session:*');
    expect(sessionKeys.length).toBeGreaterThan(0);

  
    await request(app.getHttpServer()).get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.access_token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.email).toBe(registration.email));
  });

  it('rejects invalid credentials and unauthenticated access', async () => {
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'does-not-exist@example.test', password: 'wrong-password' })
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('INVALID_CREDENTIALS'));

    await request(app.getHttpServer()).get('/api/auth/me')
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_REQUIRED'));
  });

  it('rotates refresh tokens and rejects reuse of the old token', async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
  
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: user!.email, password: 'SecurePass123!' }).expect(200);
    const oldRefreshToken = login.body.data.refresh_token;

  
    const refreshed = await request(app.getHttpServer()).post('/api/auth/refresh')
      .send({ refresh_token: oldRefreshToken }).expect(200);
    expect(refreshed.body.data.refresh_token).not.toBe(oldRefreshToken);

  
    const rejected = await request(app.getHttpServer()).post('/api/auth/refresh')
      .send({ refresh_token: oldRefreshToken })
      .expect(401);
    expect(rejected.body.success).toBe(false);
    expect(rejected.body.error.code).toBe('AUTH_REQUIRED');
    expect(rejected.body.meta).toHaveProperty('timestamp');
  });
});