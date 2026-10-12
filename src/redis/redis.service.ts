import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      console.warn('Gagal terhubung ke Redis saat startup:', error.message);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client.status === 'ready' || this.client.status === 'connecting') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch (error) {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }
}