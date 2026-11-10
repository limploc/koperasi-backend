import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service.js';
import { CreateMidtransPaymentDto } from './dto/create-midtrans-payment.dto.js';
import { MidtransWebhookDto } from './dto/midtrans-webhook.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AccessTokenPayload } from '../common/types/auth.types.js';

@Controller('api/payments/midtrans')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.BUYER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createPayment(
    @Body() dto: CreateMidtransPaymentDto,
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    const data = await this.paymentsService.createPayment(req.user.sub, dto);
    return {
      success: true,
      message: 'Payment transaction created',
      data,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() dto: MidtransWebhookDto) {
    const result = await this.paymentsService.handleWebhook(dto);
    return {
      success: result.success,
      message: result.message,
    };
  }
}
