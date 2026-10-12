import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AccessTokenPayload, RefreshTokenPayload } from '../common/types/auth.types.js';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.role === UserRole.SUPERADMIN) {
      throw new BadRequestException({ message: 'Only BUYER or SELLER accounts can be registered publicly', code: 'VALIDATION_ERROR' });
    }
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email: dto.email }, { phone_number: dto.phone_number }] } });
    if (existing) throw new ConflictException({ message: 'Email or phone number is already registered', code: 'CONFLICT_ERROR' });
    const user = await this.prisma.user.create({
      data: { email: dto.email, phone_number: dto.phone_number, password: await argon2.hash(dto.password, { type: argon2.argon2id }), role: dto.role, name: dto.name },
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.is_active || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto) {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwt.verify<RefreshTokenPayload>(dto.refresh_token, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'AUTH_REQUIRED' });
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'AUTH_REQUIRED' });
    const key = `auth:session:${payload.sid}`;
    const stored = await this.redis.getClient().get(key);
    if (!stored || stored !== this.tokenHash(dto.refresh_token)) {
      await this.redis.getClient().del(key);
      throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'AUTH_REQUIRED' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.is_active) throw new UnauthorizedException({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    await this.redis.getClient().del(key);
    return this.issueTokens(user, randomUUID());
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user?.is_active) throw new UnauthorizedException({ message: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return this.mapUser(user);
  }

  private async issueTokens(user: User, sessionId: string = randomUUID()) {
    const accessPayload: AccessTokenPayload = { sub: user.id, role: user.role, sid: sessionId, type: 'access' };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, role: user.role, sid: sessionId, type: 'refresh' };
    const accessToken = this.jwt.sign(accessPayload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as StringValue });
    const refreshToken = this.jwt.sign(refreshPayload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue });
    await this.redis.getClient().set(`auth:session:${sessionId}`, this.tokenHash(refreshToken), 'EX', Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800));
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: this.expirySeconds(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'), user: this.mapUser(user) };
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expirySeconds(value: string) {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 900;
    const units = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(match[1]) * units[match[2] as keyof typeof units];
  }

  private mapUser(user: User) {
    return { id: user.id, email: user.email, phone_number: user.phone_number, role: user.role, ...(user.name ? { name: user.name } : {}), created_at: user.created_at };
  }
}
