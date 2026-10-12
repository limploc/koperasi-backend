import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly windowSeconds = 60;
  private readonly maxRequests = 10;

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const address = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const key = `rate:auth:${request.route?.path ?? request.path}:${address}`;
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, this.windowSeconds);
    if (count > this.maxRequests) {
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
