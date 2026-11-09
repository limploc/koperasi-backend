import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

export interface SnapTransactionParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: Record<string, unknown>;
  itemDetails?: Array<Record<string, unknown>>;
}

export interface SnapTransactionResult {
  token: string;
  redirect_url: string;
}

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);
  private readonly serverKey: string;
  private readonly clientKey?: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.serverKey = this.configService.get<string>('midtrans.serverKey') ?? '';

    this.clientKey = this.configService.get<string>('midtrans.clientKey');

    this.isProduction = this.configService.get<boolean>('midtrans.isProduction') ?? false;
  }

  getSnapBaseUrl(): string {
    return this.isProduction
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
  }

  getServerKey(): string {
    return this.serverKey;
  }

  getClientKey(): string | undefined {
    return this.clientKey;
  }

  getIsProduction(): boolean {
    return this.isProduction;
  }

  async createSnapTransaction(params: SnapTransactionParams): Promise<SnapTransactionResult> {
    if (!this.serverKey) {
      throw new InternalServerErrorException({
        message: 'Midtrans server key is not configured',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    const snapUrl = `${this.getSnapBaseUrl()}/snap/v1/transactions`;
    const authHeader = `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`;

    const payload = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      ...(params.customerDetails ? { customer_details: params.customerDetails } : {}),
      ...(params.itemDetails ? { item_details: params.itemDetails } : {}),
    };

    let response: Response;
    try {
      response = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      this.logger.error(`Failed to connect to Midtrans Snap: ${errorMessage}`);
      throw new BadGatewayException({
        message: 'Payment provider connection error',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unknown provider response';
      }
      this.logger.error(`Midtrans Snap returned HTTP ${response.status}: ${errorBody}`);
      throw new BadGatewayException({
        message: 'Payment provider returned an error',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    const data = (await response.json()) as { token?: string; redirect_url?: string };

    if (!data.token || !data.redirect_url) {
      throw new BadGatewayException({
        message: 'Payment provider returned invalid transaction data',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }

    return {
      token: data.token,
      redirect_url: data.redirect_url,
    };
  }

  verifySignature(
    orderId: string,
    statusCode: string | undefined,
    grossAmount: string | number,
    signatureKey: string,
  ): boolean {
    if (!this.serverKey || !signatureKey) {
      return false;
    }

    const rawAmount = String(grossAmount);

    const safeCompare = (a: string, b: string): boolean => {
      const bufA = Buffer.from(a.toLowerCase(), 'utf8');
      const bufB = Buffer.from(b.toLowerCase(), 'utf8');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    };

    if (statusCode) {
      const input = `${orderId}${statusCode}${rawAmount}${this.serverKey}`;
      const expected = crypto.createHash('sha512').update(input).digest('hex');
      return safeCompare(expected, signatureKey);
    }

    // Fallback if status_code was omitted in payload (e.g. simplified OpenAPI mock payloads)
    for (const code of ['200', '201', '202', '']) {
      const input = `${orderId}${code}${rawAmount}${this.serverKey}`;
      const expected = crypto.createHash('sha512').update(input).digest('hex');
      if (safeCompare(expected, signatureKey)) {
        return true;
      }
    }

    return false;
  }
}
