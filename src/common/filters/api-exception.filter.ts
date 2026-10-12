import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof exceptionResponse === 'object' && exceptionResponse !== null ? exceptionResponse as Record<string, unknown> : {};
    const code = status === 400 ? 'VALIDATION_ERROR'
      : status === 401 ? (body.code ?? 'AUTH_REQUIRED')
      : status === 403 ? 'FORBIDDEN_ACCESS'
      : status === 409 ? 'CONFLICT_ERROR'
      : status === 429 ? 'VALIDATION_ERROR'
      : 'INTERNAL_SERVER_ERROR';
    const details = Array.isArray(body.message)
      ? { request: body.message.map(String) }
      : body.details;
    response.status(status).json({
      success: false,
      message: status >= 500 ? 'Internal server error' : (typeof body.message === 'string' ? body.message : 'Request failed'),
      error: { code, ...(details ? { details } : {}) },
      meta: { timestamp: new Date().toISOString(), request_id: request.headers['x-request-id'] ?? `req_${randomUUID()}` },
    });
  }
}
