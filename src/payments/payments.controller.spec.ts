import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

describe('PaymentsController', () => {
  const mockCreatePaymentResult = {
    order_id: '123e4567-e89b-12d3-a456-426614174000',
    snap_token: 'snap-token-123',
    redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
  };

  const buyerReq = {
    user: {
      sub: 'buyer-uuid-1',
      role: UserRole.BUYER,
      sid: 'session-id',
      type: 'access' as const,
    },
  };

  it('delegates createPayment and returns 200 envelope', async () => {
    const paymentsService = {
      createPayment: vi.fn().mockResolvedValue(mockCreatePaymentResult),
    };

    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(PaymentsController);
    const dto = {
      order_id: '123e4567-e89b-12d3-a456-426614174000',
      gross_amount: 150000,
    };

    const result = await controller.createPayment(dto, buyerReq as never);

    expect(result).toEqual({
      success: true,
      message: 'Payment transaction created',
      data: mockCreatePaymentResult,
    });
    expect(paymentsService.createPayment).toHaveBeenCalledWith('buyer-uuid-1', dto);
  });

  it('delegates handleWebhook and returns 200 envelope', async () => {
    const paymentsService = {
      handleWebhook: vi.fn().mockResolvedValue({
        success: true,
        message: 'Webhook processed',
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(PaymentsController);
    const webhookDto = {
      order_id: '123e4567-e89b-12d3-a456-426614174000',
      transaction_status: 'settlement',
      gross_amount: 150000,
      signature_key: 'sig-key',
    };

    const result = await controller.handleWebhook(webhookDto);

    expect(result).toEqual({
      success: true,
      message: 'Webhook processed',
    });
    expect(paymentsService.handleWebhook).toHaveBeenCalledWith(webhookDto);
  });
});
