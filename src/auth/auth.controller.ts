import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../common/types/auth.types.js';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(@Body() dto: RegisterDto) {
    return { success: true, message: 'User registered successfully', data: await this.auth.register(dto) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async login(@Body() dto: LoginDto) {
    return { success: true, message: 'Login successful', data: await this.auth.login(dto) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async refresh(@Body() dto: RefreshDto) {
    return { success: true, message: 'Token refreshed', data: await this.auth.refresh(dto) };
  }

  @Get('me')
  @Roles(UserRole.BUYER, UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async me(@Req() request: Request & { user: AccessTokenPayload }) {
    return { success: true, message: 'Current user', data: await this.auth.me(request.user.sub) };
  }
}
