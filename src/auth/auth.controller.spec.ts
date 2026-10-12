import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('AuthController', () => {
  it('delegates registration and returns the API envelope', async () => {
    const authService = {
      register: vi.fn().mockResolvedValue({ access_token: 'access', refresh_token: 'refresh' }),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(AuthRateLimitGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AuthController);
    const dto = { email: 'buyer@example.test', phone_number: '081234567890', password: 'SecurePass123!', role: UserRole.BUYER };

    await expect(controller.register(dto)).resolves.toEqual({
      success: true,
      message: 'User registered successfully',
      data: { access_token: 'access', refresh_token: 'refresh' },
    });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login and returns the API envelope', async () => {
    const authService = {
      login: vi.fn().mockResolvedValue({ access_token: 'access-login', refresh_token: 'refresh-login' }),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(AuthRateLimitGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AuthController);
    const dto = { email: 'buyer@example.test', password: 'SecurePass123!' };

    await expect(controller.login(dto)).resolves.toEqual({
      success: true,
      message: 'Login successful',
      data: { access_token: 'access-login', refresh_token: 'refresh-login' },
    });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates refresh token and returns the API envelope', async () => {
    const authService = {
      refresh: vi.fn().mockResolvedValue({ access_token: 'access-refreshed', refresh_token: 'refresh-refreshed' }),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(AuthRateLimitGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AuthController);
    const dto = { refresh_token: 'valid-refresh-token' };

    await expect(controller.refresh(dto)).resolves.toEqual({
      success: true,
      message: 'Token refreshed',
      data: { access_token: 'access-refreshed', refresh_token: 'refresh-refreshed' },
    });
    expect(authService.refresh).toHaveBeenCalledWith(dto);
  });

  it('passes the authenticated subject to the current-user service', async () => {
    const authService = { me: vi.fn().mockResolvedValue({ id: 'user-id', role: UserRole.BUYER }) };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(AuthRateLimitGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();
    const controller = module.get(AuthController);

    await expect(controller.me({ user: { sub: 'user-id', role: UserRole.BUYER, sid: 'session', type: 'access' } } as never))
      .resolves.toEqual({ success: true, message: 'Current user', data: { id: 'user-id', role: UserRole.BUYER } });
    expect(authService.me).toHaveBeenCalledWith('user-id');
  });
});
