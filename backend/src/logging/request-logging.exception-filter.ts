import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { StructuredLogger } from './structured-logger.service.js';
import type { RequestWithContext } from './request-id.middleware.js';

const UNLOGGED_PATH_PREFIX = '/health';

/**
 * Owns failure logging. Living here rather than in the interceptor is what
 * makes a rejected action observable: guards throw before the interceptor chain
 * runs, so an unauthorized call never reaches an interceptor. The response is
 * delegated to Nest's default handling so error bodies are unchanged.
 */
@Catch()
export class RequestLoggingExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger();

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<RequestWithContext>();
    const level = exception instanceof HttpException && exception.getStatus() < 500 ? 'warn' : 'error';

    if (!request.path?.startsWith(UNLOGGED_PATH_PREFIX)) {
      this.logger[level]('http.request.failed', {
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: RequestLoggingExceptionFilter.statusOf(exception),
        durationMs: RequestLoggingExceptionFilter.elapsedSince(request),
        actorId: request.actor?.employeeId ?? null,
        error: exception,
      });
    }

    super.catch(exception, host);
  }

  static statusOf(exception: unknown): number {
    return exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  static elapsedSince(request: RequestWithContext): number | null {
    return typeof request.startedAt === 'number' ? Date.now() - request.startedAt : null;
  }
}
