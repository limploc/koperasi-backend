import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadGatewayException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { MidtransService } from './midtrans.service.js';

describe('MidtransService', () => {
  let service: MidtransService;
  let configService: { get: ReturnType<typeof vi.fn> };
  const mockServerKey = 'test-server-key';

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'MIDTRANS_SERVER_KEY') return mockServerKey;
        if (key === 'MIDTRANS_CLIENT_KEY') return 'test-client-key';
        if (key === 'MIDTRANS_IS_PRODUCTION') return 'false';
        return undefined;
      }),
    };
    service = new MidtransService(configService as unknown as ConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('throws InternalServerErrorException if server key is not configured when creating Snap transaction', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'MIDTRANS_SERVER_KEY') return '';
        return undefined;
      });
      const unconfiguredService = new MidtransService(configService as unknown as ConfigService);

      await expect(
        unconfiguredService.createSnapTransaction({
          orderId: 'ORDER-1',
          grossAmount: 100000,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns sandbox URL when isProduction is false', () => {
      expect(service.getSnapBaseUrl()).toBe('https://app.sandbox.midtrans.com');
    });

    it('returns production URL when isProduction is true', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'MIDTRANS_SERVER_KEY') return mockServerKey;
        if (key === 'MIDTRANS_IS_PRODUCTION') return 'true';
        return undefined;
      });
      const prodService = new MidtransService(configService as unknown as ConfigService);
      expect(prodService.getSnapBaseUrl()).toBe('https://app.midtrans.com');
    });
  });

  describe('createSnapTransaction', () => {
    it('creates Snap transaction successfully and returns token and redirect_url', async () => {
      const mockResponse = {
        token: 'snap-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await service.createSnapTransaction({
        orderId: 'ORDER-1',
        grossAmount: 150000,
        customerDetails: { first_name: 'Buyer' },
        itemDetails: [{ id: 'item-1', price: 150000, quantity: 1, name: 'Item 1' }],
      });

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://app.sandbox.midtrans.com/snap/v1/transactions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from(`${mockServerKey}:`).toString('base64')}`,
          }),
        }),
      );
    });

    it('throws BadGatewayException when network error occurs', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.createSnapTransaction({
          orderId: 'ORDER-1',
          grossAmount: 100000,
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when provider returns 4xx or 5xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error_messages":["Order ID already used"]}',
      } as unknown as Response);

      await expect(
        service.createSnapTransaction({
          orderId: 'ORDER-1',
          grossAmount: 100000,
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when provider returns invalid payload', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ token: '' }),
      } as unknown as Response);

      await expect(
        service.createSnapTransaction({
          orderId: 'ORDER-1',
          grossAmount: 100000,
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('verifySignature', () => {
    it('returns true for valid standard signature with status_code', () => {
      const orderId = 'ORDER-123';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const raw = `${orderId}${statusCode}${grossAmount}${mockServerKey}`;
      const validSignature = crypto.createHash('sha512').update(raw).digest('hex');

      const isValid = service.verifySignature(orderId, statusCode, grossAmount, validSignature);
      expect(isValid).toBe(true);
    });

    it('returns false for invalid signature key', () => {
      const orderId = 'ORDER-123';
      const statusCode = '200';
      const grossAmount = '150000';
      const invalidSignature = 'invalid-signature-key-hex-value';

      const isValid = service.verifySignature(orderId, statusCode, grossAmount, invalidSignature);
      expect(isValid).toBe(false);
    });

    it('returns false if serverKey is missing', () => {
      configService.get.mockImplementation(() => '');
      const unconfiguredService = new MidtransService(configService as unknown as ConfigService);

      const isValid = unconfiguredService.verifySignature('ORDER-1', '200', '10000', 'some-sig');
      expect(isValid).toBe(false);
    });

    it('returns true when status_code is omitted but signature matches standard 200 code', () => {
      const orderId = 'ORDER-123';
      const grossAmount = 150000;
      const raw = `${orderId}200${grossAmount}${mockServerKey}`;
      const signature = crypto.createHash('sha512').update(raw).digest('hex');

      const isValid = service.verifySignature(orderId, undefined, grossAmount, signature);
      expect(isValid).toBe(true);
    });

    it('preserves exact decimal string representation in gross_amount when verifying signature', () => {
      const orderId = 'ORDER-123';
      const statusCode = '200';
      const decimalAmount = '150000.00';
      const raw = `${orderId}${statusCode}${decimalAmount}${mockServerKey}`;
      const signature = crypto.createHash('sha512').update(raw).digest('hex');

      expect(service.verifySignature(orderId, statusCode, decimalAmount, signature)).toBe(true);
      // Integer version should fail against decimal signature
      expect(service.verifySignature(orderId, statusCode, '150000', signature)).toBe(false);
    });
  });
});
