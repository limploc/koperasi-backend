import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { randomUUID } from 'node:crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' });
  app.use((request: { headers: Record<string, string | string[] | undefined>; [key: string]: unknown }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    const requestId = typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : `req_${randomUUID()}`;
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(Number(process.env.PORT ?? 8000));
}
await bootstrap();
