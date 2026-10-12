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
    const code = (typeof body.code === 'string' && body.code)
      ? body.code
      : status === 400 ? 'VALIDATION_ERROR'
      : status === 401 ? 'AUTH_REQUIRED'
      : status === 403 ? 'FORBIDDEN_ACCESS'
      : status === 404 ? 'RESOURCE_NOT_FOUND'
      : status === 409 ? 'CONFLICT_ERROR'
      : 'INTERNAL_SERVER_ERROR';

    const details = Array.isArray(body.message)
      ? { request: body.message.map(String) }
      : (typeof body.details === 'object' && body.details !== null ? body.details : undefined);

    const message = status >= 500
      ? 'Internal server error'
      : (typeof body.message === 'string'
          ? body.message
          : (typeof exceptionResponse === 'string'
              ? exceptionResponse
              : (exception instanceof Error ? exception.message : 'Request failed')));

    response.status(status).json({
      success: false,
      message,
      error: {
        code,
        ...(details ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: (request.headers?.['x-request-id'] as string) ?? `req_${randomUUID()}`,
      },
    });
  }
}
