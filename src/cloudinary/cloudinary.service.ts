import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL') || process.env.CLOUDINARY_URL;
    if (cloudinaryUrl) {
      cloudinary.config({
        cloudinary_url: cloudinaryUrl,
      });
    }
  }

  async uploadImage(
    fileBufferOrPathOrUrl: Buffer | string,
    options: { folder?: string; publicId?: string } = {},
  ): Promise<CloudinaryUploadResult> {
    const folder = options.folder ?? 'products';

    try {
      if (typeof fileBufferOrPathOrUrl === 'string') {
        const result: UploadApiResponse = await cloudinary.uploader.upload(fileBufferOrPathOrUrl, {
          folder,
          public_id: options.publicId,
          resource_type: 'image',
        });
        return {
          secure_url: result.secure_url,
          public_id: result.public_id,
        };
      } else {
        return await new Promise<CloudinaryUploadResult>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              public_id: options.publicId,
              resource_type: 'image',
            },
            (error, result) => {
              if (error || !result) {
                return reject(error ?? new Error('Cloudinary upload returned empty response'));
              }
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
              });
            },
          );
          uploadStream.end(fileBufferOrPathOrUrl);
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown upload error';
      this.logger.error(`Cloudinary upload failed: ${message}`);
      throw new Error(`Cloudinary upload failed: ${message}`);
    }
  }

  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      return result?.result === 'ok';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown deletion error';
      this.logger.error(`Cloudinary deletion failed: ${message}`);
      return false;
    }
  }

  extractPublicIdFromUrl(imageUrl?: string | null): string | null {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    try {
      // Cloudinary URL format:
      // https://res.cloudinary.com/<cloud_name>/image/upload/(v<version>/)?(folder/)?<public_id>.<ext>
      const uploadIndex = imageUrl.indexOf('/upload/');
      if (uploadIndex === -1) return null;

      let subPath = imageUrl.slice(uploadIndex + '/upload/'.length);
      // Remove version prefix if present, e.g. v1234567890/
      subPath = subPath.replace(/^v\d+\//, '');

      // Remove extension if present
      const lastDotIndex = subPath.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        subPath = subPath.substring(0, lastDotIndex);
      }

      return subPath || null;
    } catch {
      return null;
    }
  }

  isCloudinaryUrl(url?: string | null): boolean {
    if (!url || typeof url !== 'string') return false;
    return url.includes('res.cloudinary.com') || url.includes('cloudinary');
  }

  validateImageInput(file: { buffer: Buffer; mimetype?: string; size?: number }, maxSize = 5 * 1024 * 1024): void {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const size = file.size ?? file.buffer.length;
    if (size > maxSize) {
      throw new Error(`File size ${size} bytes exceeds limit of ${maxSize} bytes`);
    }
    if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }
  }
}
