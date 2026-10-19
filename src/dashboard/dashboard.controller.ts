import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AccessTokenPayload } from '../common/types/auth.types.js';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('seller')
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getSellerDashboard(@Req() req: Request & { user: AccessTokenPayload }) {
    const data = await this.dashboardService.getSellerDashboard(req.user.sub);
    return {
      success: true,
      message: 'Dashboard analytics',
      data,
    };
  }
}
