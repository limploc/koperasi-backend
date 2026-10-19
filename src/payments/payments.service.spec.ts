import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  PaymentTransactionStatus,
  UserRole,
} from '@prisma/client';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { MidtransService } from './midtrans/midtrans.service.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    paymentTransaction: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    product: {
      update: ReturnType<typeof vi.fn>;
    };
    rentalItem: {
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let midtransService: {
    createSnapTransaction: ReturnType<typeof vi.fn>;
    verifySignature: ReturnType<typeof vi.fn>;
  };

  const buyerId = 'buyer-uuid-1';
  const orderId = '123e4567-e89b-12d3-a456-426614174000';

  const mockOrder = {
    id: orderId,
    buyer_id: buyerId,
    total_amount: 150000,
    status: OrderStatus.pending,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    buyer: {
      id: buyerId,
      name: 'Test Buyer',
      email: 'buyer@example.com',
      phone_number: '08123456789',
      role: UserRole.BUYER,
    },
    items: [
      {
        id: 'item-uuid-1',
        order_id: orderId,
        product_id: 'prod-uuid-1',
        rental_item_id: null,
        price: 150000,
        quantity: 1,
        subtotal: 150000,
        product: { name: 'Kelapa Segar' },
        rental_item: null,
      },
    ],
    payments: [],
  };

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      paymentTransaction: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      rentalItem: {
        update: vi.fn(),
      },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    midtransService = {
      createSnapTransaction: vi.fn(),
      verifySignature: vi.fn(),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      midtransService as unknown as MidtransService,
    );
  });

  describe('createPayment', () => {
    it('successfully creates Snap transaction for valid pending order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      midtransService.createSnapTransaction.mockResolvedValue({
        token: 'snap-token-abc',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-abc',
      });
      prisma.paymentTransaction.create.mockResolvedValue({ id: 'payment-1' });

      const result = await service.createPayment(buyerId, {
        order_id: orderId,
        gross_amount: 150000,
      });

      expect(result).toEqual({
        order_id: orderId,
        snap_token: 'snap-token-abc',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-abc',
      });
      expect(midtransService.createSnapTransaction).toHaveBeenCalledWith({
        orderId: orderId,
        grossAmount: 150000,
        customerDetails: {
          first_name: 'Test Buyer',
          email: 'buyer@example.com',
          phone: '08123456789',
        },
        itemDetails: [
          {
            id: 'prod-uuid-1',
            price: 150000,
            quantity: 1,
            name: 'Kelapa Segar',
          },
        ],
      });
      expect(prisma.paymentTransaction.create).toHaveBeenCalled();
    });

    it('reuses existing pending payment transaction when valid token exists', async () => {
      const orderWithPendingPayment = {
        ...mockOrder,
        payments: [
          {
            id: 'existing-payment-id',
            provider: PaymentProvider.MIDTRANS,
            provider_order_id: orderId,
            transaction_status: PaymentTransactionStatus.pending,
            snap_token: 'existing-token',
            redirect_url: 'https://existing-redirect-url.com',
          },
        ],
      };
      prisma.order.findUnique.mockResolvedValue(orderWithPendingPayment);

      const result = await service.createPayment(buyerId, {
        order_id: orderId,
        gross_amount: 150000,
      });

      expect(result).toEqual({
        order_id: orderId,
        snap_token: 'existing-token',
        redirect_url: 'https://existing-redirect-url.com',
      });
      expect(midtransService.createSnapTransaction).not.toHaveBeenCalled();
      expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(buyerId, {
          order_id: 'non-existent',
          gross_amount: 100000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if order belongs to another buyer', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        buyer_id: 'different-buyer',
      });

      await expect(
        service.createPayment(buyerId, {
          order_id: orderId,
          gross_amount: 150000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if order is not in pending status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.paid,
      });

      await expect(
        service.createPayment(buyerId, {
          order_id: orderId,
          gross_amount: 150000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if supplied gross_amount does not match order total', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.createPayment(buyerId, {
          order_id: orderId,
          gross_amount: 999999, // tampered amount
        }),
      ).rejects.toThrow(BadRequestException);
      expect(midtransService.createSnapTransaction).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    const validWebhookPayload = {
      order_id: orderId,
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '150000.00',
      signature_key: 'valid-sig',
      payment_type: 'bank_transfer',
    };

    it('processes settlement webhook, transitions order to paid, and updates payment transaction', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      prisma.paymentTransaction.findFirst.mockResolvedValue({
        id: 'payment-1',
        order_id: orderId,
        order: mockOrder,
      });
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.handleWebhook(validWebhookPayload);

      expect(result).toEqual({ success: true, message: 'Webhook processed' });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: OrderStatus.paid },
      });
      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          transaction_status: PaymentTransactionStatus.settlement,
          payment_type: 'bank_transfer',
        }),
      });
    });

    it('rejects webhook with invalid signature', async () => {
      midtransService.verifySignature.mockReturnValue(false);

      await expect(service.handleWebhook(validWebhookPayload)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rejects webhook if order is not found', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      prisma.paymentTransaction.findFirst.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.handleWebhook({
          ...validWebhookPayload,
          order_id: 'unknown-order',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects webhook if gross_amount does not match order total', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      prisma.paymentTransaction.findFirst.mockResolvedValue({
        id: 'payment-1',
        order_id: orderId,
        order: mockOrder,
      });

      await expect(
        service.handleWebhook({
          ...validWebhookPayload,
          gross_amount: '999999.00',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('maps deny, expire, and cancel to failed and restores stock', async () => {
      for (const status of ['deny', 'expire', 'cancel']) {
        vi.clearAllMocks();
        midtransService.verifySignature.mockReturnValue(true);
        prisma.paymentTransaction.findFirst.mockResolvedValue({
          id: 'payment-1',
          order_id: orderId,
          order: mockOrder,
        });
        prisma.order.findUnique.mockResolvedValue(mockOrder);

        const result = await service.handleWebhook({
          ...validWebhookPayload,
          transaction_status: status,
        });

        expect(result).toEqual({ success: true, message: 'Webhook processed' });
        expect(prisma.order.update).toHaveBeenCalledWith({
          where: { id: orderId },
          data: { status: OrderStatus.failed },
        });
        expect(prisma.product.update).toHaveBeenCalledWith({
          where: { id: 'prod-uuid-1' },
          data: { stock: { increment: 1 } },
        });
      }
    });

    it('is idempotent when duplicate settlement notification arrives', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      const paidOrder = { ...mockOrder, status: OrderStatus.paid };
      prisma.paymentTransaction.findFirst.mockResolvedValue({
        id: 'payment-1',
        order_id: orderId,
        order: paidOrder,
      });
      prisma.order.findUnique.mockResolvedValue(paidOrder);

      const result = await service.handleWebhook(validWebhookPayload);

      expect(result).toEqual({ success: true, message: 'Webhook processed' });
      // Order status update should not be called since it is already paid
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('does not revert paid order if delayed expire arrives', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      const paidOrder = { ...mockOrder, status: OrderStatus.paid };
      prisma.paymentTransaction.findFirst.mockResolvedValue({
        id: 'payment-1',
        order_id: orderId,
        order: paidOrder,
      });
      prisma.order.findUnique.mockResolvedValue(paidOrder);

      const result = await service.handleWebhook({
        ...validWebhookPayload,
        transaction_status: 'expire',
      });

      expect(result).toEqual({ success: true, message: 'Webhook processed' });
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for unsupported transaction status', async () => {
      midtransService.verifySignature.mockReturnValue(true);
      prisma.paymentTransaction.findFirst.mockResolvedValue({
        id: 'payment-1',
        order_id: orderId,
        order: mockOrder,
      });

      await expect(
        service.handleWebhook({
          ...validWebhookPayload,
          transaction_status: 'unsupported_status',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
