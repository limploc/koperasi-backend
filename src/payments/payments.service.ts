import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  PaymentTransactionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { MidtransService } from './midtrans/midtrans.service.js';
import { CreateMidtransPaymentDto } from './dto/create-midtrans-payment.dto.js';
import { MidtransWebhookDto } from './dto/midtrans-webhook.dto.js';

export interface CreatePaymentResult {
  order_id: string;
  snap_token: string;
  redirect_url: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly midtransService: MidtransService,
  ) {}

  async createPayment(
    buyerId: string,
    dto: CreateMidtransPaymentDto,
  ): Promise<CreatePaymentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.order_id },
      include: {
        items: {
          include: {
            product: true,
            rental_item: true,
          },
        },
        buyer: true,
        payments: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (order.buyer_id !== buyerId) {
      throw new ForbiddenException({
        message: 'Forbidden - not order owner',
        code: 'FORBIDDEN_ACCESS',
      });
    }

    if (order.status !== OrderStatus.pending) {
      throw new BadRequestException({
        message: 'Order is not eligible for payment',
        code: 'VALIDATION_ERROR',
        details: { status: ['Order is not in pending status'] },
      });
    }

    if (dto.gross_amount !== order.total_amount) {
      throw new BadRequestException({
        message: 'Gross amount mismatch',
        code: 'VALIDATION_ERROR',
        details: {
          gross_amount: ['Provided gross_amount does not match authoritative order total'],
        },
      });
    }

    // Reuse existing valid pending payment transaction if present
    const existingPending = order.payments.find(
      (p) =>
        p.provider === PaymentProvider.MIDTRANS &&
        p.transaction_status === PaymentTransactionStatus.pending &&
        p.snap_token &&
        p.redirect_url,
    );

    if (existingPending && existingPending.snap_token && existingPending.redirect_url) {
      return {
        order_id: order.id,
        snap_token: existingPending.snap_token,
        redirect_url: existingPending.redirect_url,
      };
    }

    // Determine unique provider_order_id
    const attempt = order.payments.length;
    const providerOrderId = attempt === 0 ? order.id : `${order.id}-${attempt + 1}`;

    const customerDetails = {
      first_name: order.buyer.name || 'Customer',
      email: order.buyer.email,
      phone: order.buyer.phone_number,
    };

    const itemDetails = order.items.map((item) => ({
      id: (item.product_id ?? item.rental_item_id ?? item.id).slice(0, 50),
      price: item.price,
      quantity: item.quantity,
      name: (item.product?.name ?? item.rental_item?.name ?? 'Item').slice(0, 50),
    }));

    const snapResult = await this.midtransService.createSnapTransaction({
      orderId: providerOrderId,
      grossAmount: order.total_amount,
      customerDetails,
      itemDetails,
    });

    await this.prisma.paymentTransaction.create({
      data: {
        order_id: order.id,
        provider: PaymentProvider.MIDTRANS,
        provider_order_id: providerOrderId,
        snap_token: snapResult.token,
        redirect_url: snapResult.redirect_url,
        gross_amount: order.total_amount,
        transaction_status: PaymentTransactionStatus.pending,
      },
    });

    return {
      order_id: order.id,
      snap_token: snapResult.token,
      redirect_url: snapResult.redirect_url,
    };
  }

  async handleWebhook(payload: MidtransWebhookDto): Promise<{ success: boolean; message: string }> {
    const isSignatureValid = this.midtransService.verifySignature(
      payload.order_id,
      payload.status_code,
      payload.gross_amount,
      payload.signature_key,
    );

    if (!isSignatureValid) {
      throw new BadRequestException({
        message: 'Invalid signature key',
        code: 'VALIDATION_ERROR',
      });
    }

    let payment = await this.prisma.paymentTransaction.findFirst({
      where: {
        provider: PaymentProvider.MIDTRANS,
        provider_order_id: payload.order_id,
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    let order = payment?.order ?? null;

    if (!order) {
      const baseOrderId = payload.order_id.split('-').slice(0, 5).join('-');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseOrderId);
      if (isUuid) {
        order = await this.prisma.order.findUnique({
          where: { id: baseOrderId },
          include: { items: true },
        });
      }
    }

    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const receivedAmount = Math.round(Number(payload.gross_amount));
    if (receivedAmount !== order.total_amount) {
      throw new BadRequestException({
        message: 'Inconsistent payment gross amount',
        code: 'VALIDATION_ERROR',
      });
    }

    let targetOrderStatus: OrderStatus;
    let targetPaymentStatus: PaymentTransactionStatus;

    switch (payload.transaction_status) {
      case 'settlement':
        targetOrderStatus = OrderStatus.paid;
        targetPaymentStatus = PaymentTransactionStatus.settlement;
        break;
      case 'pending':
        targetOrderStatus = OrderStatus.pending;
        targetPaymentStatus = PaymentTransactionStatus.pending;
        break;
      case 'deny':
        targetOrderStatus = OrderStatus.failed;
        targetPaymentStatus = PaymentTransactionStatus.deny;
        break;
      case 'expire':
        targetOrderStatus = OrderStatus.failed;
        targetPaymentStatus = PaymentTransactionStatus.expire;
        break;
      case 'cancel':
        targetOrderStatus = OrderStatus.failed;
        targetPaymentStatus = PaymentTransactionStatus.cancel;
        break;
      default:
        throw new BadRequestException({
          message: `Unsupported transaction status: ${payload.transaction_status}`,
          code: 'VALIDATION_ERROR',
        });
    }

    await this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      if (!currentOrder) {
        throw new NotFoundException({
          message: 'Order not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      // If already paid, do not revert to pending or failed
      if (currentOrder.status === OrderStatus.paid) {
        if (payment) {
          await tx.paymentTransaction.update({
            where: { id: payment.id },
            data: {
              payment_type: payload.payment_type ?? payment.payment_type,
              raw_response: payload as unknown as Prisma.InputJsonValue,
            },
          });
        }
        return;
      }

      // If already failed, do not revert to pending
      if (currentOrder.status === OrderStatus.failed && targetOrderStatus === OrderStatus.pending) {
        return;
      }

      // If transitioning from pending to failed, restore stock and rental units
      if (currentOrder.status === OrderStatus.pending && targetOrderStatus === OrderStatus.failed) {
        for (const item of currentOrder.items) {
          if (item.product_id) {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } },
            });
          } else if (item.rental_item_id) {
            await tx.rentalItem.update({
              where: { id: item.rental_item_id },
              data: { available_units: { increment: item.quantity } },
            });
          }
        }
      }

      // Update order status if it was pending
      if (currentOrder.status === OrderStatus.pending) {
        await tx.order.update({
          where: { id: currentOrder.id },
          data: { status: targetOrderStatus },
        });
      }

      // Update or create payment transaction
      if (payment) {
        await tx.paymentTransaction.update({
          where: { id: payment.id },
          data: {
            transaction_status: targetPaymentStatus,
            payment_type: payload.payment_type ?? payment.payment_type,
            signature_key: payload.signature_key,
            raw_response: payload as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await tx.paymentTransaction.create({
          data: {
            order_id: currentOrder.id,
            provider: PaymentProvider.MIDTRANS,
            provider_order_id: payload.order_id,
            gross_amount: currentOrder.total_amount,
            transaction_status: targetPaymentStatus,
            payment_type: payload.payment_type ?? null,
            signature_key: payload.signature_key,
            raw_response: payload as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    return {
      success: true,
      message: 'Webhook processed',
    };
  }
}
