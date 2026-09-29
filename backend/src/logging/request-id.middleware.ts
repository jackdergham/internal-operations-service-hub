import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Actor } from '../directory/directory.types.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;

/** Request shape observed by the logging layer, after guards have run. */
export type RequestWithContext = Request & { requestId?: string; startedAt?: number; actor?: Actor };

/**
 * Assigns a correlation id to every inbound request before guards and handlers
 * run, so that failures raised anywhere downstream still carry it. An inbound
 * id is reused so a retry or a trace from a caller can be followed end to end.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const context = request as RequestWithContext;
    context.requestId = RequestIdMiddleware.resolve(request.headers[REQUEST_ID_HEADER]);
    context.startedAt = Date.now();
    response.setHeader(REQUEST_ID_HEADER, context.requestId);
    next();
  }

  private static resolve(header: string | string[] | undefined): string {
    const candidate = Array.isArray(header) ? header[0] : header;
    if (typeof candidate !== 'string') return randomUUID();

    const trimmed = candidate.trim();
    if (!trimmed) return randomUUID();
    return trimmed.slice(0, MAX_REQUEST_ID_LENGTH);
  }
}
