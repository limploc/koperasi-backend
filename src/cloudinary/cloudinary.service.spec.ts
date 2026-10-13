import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('cloudinary', () => {
  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload: vi.fn(),
        upload_stream: vi.fn(),
        destroy: vi.fn(),
      },
    },
  };
});

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = {
      get: vi.fn().mockReturnValue('cloudinary://api_key:api_secret@test-cloud'),
    } as unknown as ConfigService;
    service = new CloudinaryService(configService);
  });

  describe('configuration', () => {
    it('initializes cloudinary with URL from config', () => {
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloudinary_url: 'cloudinary://api_key:api_secret@test-cloud',
      });
    });
  });

  describe('uploadImage', () => {
    it('uploads an image from a URL successfully', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/sample.jpg',
        public_id: 'products/sample',
      };
      (cloudinary.uploader.upload as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await service.uploadImage('https://example.com/image.jpg', { folder: 'products' });

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith('https://example.com/image.jpg', {
        folder: 'products',
        public_id: undefined,
        resource_type: 'image',
      });
      expect(result).toEqual({
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/sample.jpg',
        public_id: 'products/sample',
      });
    });

    it('uploads an image from a buffer successfully', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1234/products/buffer.jpg',
        public_id: 'products/buffer',
      };
      (cloudinary.uploader.upload_stream as unknown as ReturnType<typeof vi.fn>).mockImplementation((options, cb) => {
        return {
          end: vi.fn().mockImplementation(() => {
            cb(null, mockResult);
          }),
        };
      });

      const buffer = Buffer.from('fake-image-bytes');
      const result = await service.uploadImage(buffer, { folder: 'products', publicId: 'buffer' });

      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        { folder: 'products', public_id: 'buffer', resource_type: 'image' },
        expect.any(Function),
      );
      expect(result).toEqual(mockResult);
    });

    it('handles upload failure and throws an error', async () => {
      (cloudinary.uploader.upload as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error during upload'),
      );

      await expect(service.uploadImage('https://example.com/bad.jpg')).rejects.toThrow(
        'Cloudinary upload failed: Network error during upload',
      );
    });

    it('handles upload_stream callback error', async () => {
      (cloudinary.uploader.upload_stream as unknown as ReturnType<typeof vi.fn>).mockImplementation((options, cb) => {
        return {
          end: vi.fn().mockImplementation(() => {
            cb(new Error('Stream failure'), null);
          }),
        };
      });

      const buffer = Buffer.from('fake-image-bytes');
      await expect(service.uploadImage(buffer)).rejects.toThrow('Cloudinary upload failed: Stream failure');
    });
  });

  describe('deleteImage', () => {
    it('deletes an image successfully', async () => {
      (cloudinary.uploader.destroy as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ result: 'ok' });

      const success = await service.deleteImage('products/sample');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('products/sample', {
        resource_type: 'image',
      });
      expect(success).toBe(true);
    });

    it('handles deletion failure safely without throwing', async () => {
      (cloudinary.uploader.destroy as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Asset not found or network down'),
      );

      const success = await service.deleteImage('products/nonexistent');

      expect(success).toBe(false);
    });
  });

  describe('extractPublicIdFromUrl', () => {
    it('extracts public ID from versioned Cloudinary URL', () => {
      const url = 'https://res.cloudinary.com/test-cloud/image/upload/v1234567890/products/my-product.jpg';
      const publicId = service.extractPublicIdFromUrl(url);
      expect(publicId).toBe('products/my-product');
    });

    it('extracts public ID from unversioned Cloudinary URL', () => {
      const url = 'https://res.cloudinary.com/test-cloud/image/upload/products/sample.png';
      const publicId = service.extractPublicIdFromUrl(url);
      expect(publicId).toBe('products/sample');
    });

    it('returns null for non-Cloudinary URL', () => {
      const url = 'https://external-cdn.com/images/product.jpg';
      const publicId = service.extractPublicIdFromUrl(url);
      expect(publicId).toBeNull();
    });

    it('returns null for null or empty input', () => {
      expect(service.extractPublicIdFromUrl(null)).toBeNull();
      expect(service.extractPublicIdFromUrl('')).toBeNull();
    });
  });

  describe('isCloudinaryUrl', () => {
    it('returns true for Cloudinary URLs', () => {
      expect(service.isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
    });

    it('returns false for external URLs', () => {
      expect(service.isCloudinaryUrl('https://example.com/sample.jpg')).toBe(false);
      expect(service.isCloudinaryUrl('')).toBe(false);
      expect(service.isCloudinaryUrl(null)).toBe(false);
    });
  });

  describe('validateImageInput', () => {
    it('passes for valid image buffer and MIME type', () => {
      const buffer = Buffer.alloc(1024);
      expect(() =>
        service.validateImageInput({ buffer, mimetype: 'image/jpeg', size: 1024 }),
      ).not.toThrow();
    });

    it('throws when file size exceeds maximum limit', () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024);
      expect(() =>
        service.validateImageInput({ buffer, mimetype: 'image/png', size: 10 * 1024 * 1024 }, 5 * 1024 * 1024),
      ).toThrow(/exceeds limit/);
    });

    it('throws when MIME type is not allowed', () => {
      const buffer = Buffer.alloc(512);
      expect(() =>
        service.validateImageInput({ buffer, mimetype: 'application/pdf', size: 512 }),
      ).toThrow(/Invalid file type/);
    });
  });
});
