import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { StructuredLogger } from './structured-logger.service.js';
import { RequestLoggingExceptionFilter } from './request-logging.exception-filter.js';
import type { RequestWithContext } from './request-id.middleware.js';

const UNLOGGED_PATH_PREFIX = '/health';

/**
 * Records one line per successful request. Failures are deliberately not logged
 * here: a guard rejects the request before this chain is ever entered, so the
 * exception filter is the only place that sees every rejection.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();

    return next.handle().pipe(
      tap(() => {
        // Platform health polling would otherwise dominate the log volume.
        if (request.path?.startsWith(UNLOGGED_PATH_PREFIX)) return;

        this.logger.info('http.request.completed', {
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: http.getResponse()?.statusCode,
          durationMs: RequestLoggingExceptionFilter.elapsedSince(request),
          actorId: request.actor?.employeeId ?? null,
        });
      }),
    );
  }
}
