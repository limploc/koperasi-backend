import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

describe('AuthService', () => {
  const prisma = { user: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() } };
  const redisClient = { set: vi.fn().mockResolvedValue('OK'), get: vi.fn(), del: vi.fn() };
  const redis = { getClient: () => redisClient };
  const jwt = {
    sign: vi.fn((payload: object) => `${payload.type}-token`),
    verify: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'unit-access-secret';
    process.env.JWT_REFRESH_SECRET = 'unit-refresh-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    return module.get(AuthService);
  }

  it('hashes the password before persistence and creates a Redis session', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'user-id', email: data.email, phone_number: data.phone_number, password: data.password,
      role: data.role, is_active: true, created_at: new Date(), updated_at: new Date(),
    }));
    const service = await createService();

    const result = await service.register({
      email: 'buyer@example.test', phone_number: '081234567890', password: 'SecurePass123!', role: UserRole.BUYER,
    });

    expect(prisma.user.create).toHaveBeenCalled();
    const saved = prisma.user.create.mock.calls[0][0].data.password as string;
    expect(saved).not.toBe('SecurePass123!');
    expect(saved).toMatch(/^\$argon2id\$/);
    expect(redisClient.set).toHaveBeenCalledWith(expect.stringMatching(/^auth:session:/), expect.any(String), 'EX', expect.any(Number));
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toBe('refresh-token');
  });

  it('rejects invalid credentials without issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const service = await createService();

    await expect(service.login({ email: 'missing@example.test', password: 'wrong-password' }))
      .rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
