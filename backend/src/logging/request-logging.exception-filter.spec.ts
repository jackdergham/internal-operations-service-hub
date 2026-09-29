import { ForbiddenException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { RequestLoggingExceptionFilter } from './request-logging.exception-filter.js';
import type { RequestWithContext } from './request-id.middleware.js';

function requestFor(overrides: Partial<RequestWithContext> = {}): RequestWithContext {
  return {
    method: 'GET',
    originalUrl: '/requests/mine',
    path: '/requests/mine',
    requestId: 'req-99',
    startedAt: Date.now(),
    ...overrides,
  } as RequestWithContext;
}

/**
 * Nest's BaseExceptionFilter reads the response through getArgByIndex and writes
 * through an adapter. Both are doubled here sharing one set of spies, because
 * the error body itself is Nest's existing behaviour, not what changed.
 */
function runFilter(exception: unknown, request: unknown) {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status: status.mockReturnValue({ json }) } as unknown as Response;

  const adapter = {
    isHeadersSent: () => false,
    reply: (_response: unknown, body: unknown, code: number) => { status(code); json(body); },
    end: () => {},
  };

  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    getArgByIndex: (index: number) => (index === 1 ? response : request),
  } as unknown as ArgumentsHost;

  const filter = new RequestLoggingExceptionFilter();
  Object.assign(filter, { applicationRef: adapter });
  filter.catch(exception, host);

  return { status, json };
}

describe('RequestLoggingExceptionFilter', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Nest's own ExceptionsHandler logs unexpected errors; not what is under test.
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const lastRecord = (spy: typeof warn) =>
    JSON.parse(vi.mocked(spy).mock.calls[0][0] as string) as Record<string, unknown>;

  it('records a guard rejection that an interceptor would never see', () => {
    runFilter(new ForbiddenException('Only the designated approver may decide a step'), requestFor());

    expect(warn).toHaveBeenCalledOnce();
    expect(lastRecord(warn)).toMatchObject({
      event: 'http.request.failed',
      requestId: 'req-99',
      statusCode: 403,
      actorId: null,
    });
  });

  it('keeps the actor when the guard passed and the handler then failed', () => {
    const request = requestFor({
      actor: { employeeId: 'employee-2', name: 'Karim Fares', department: 'HR', managerId: null, roles: ['requester'] },
    });

    runFilter(new NotFoundException('Request not found'), request);

    expect(lastRecord(warn).actorId).toBe('employee-2');
  });

  it('classifies an unexpected error as a server error and logs it at error level', () => {
    runFilter(new Error('prisma exploded'), requestFor());

    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    const record = lastRecord(error);
    expect(record).toMatchObject({ event: 'http.request.failed', statusCode: HttpStatus.INTERNAL_SERVER_ERROR });
    expect(record.error).toEqual({ name: 'Error', message: 'prisma exploded' });
  });

  it('masks a secret that leaks through an error message', () => {
    runFilter(new Error('failed to reach postgres://admin:hunter2@db.internal:5432/ops'), requestFor());

    expect(JSON.stringify(lastRecord(error))).not.toContain('hunter2');
  });

  it('still produces the standard Nest error response', () => {
    const { status, json } = runFilter(new NotFoundException('Request not found'), requestFor());

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Request not found' }),
    );
  });

  it('skips health paths so platform polling does not dominate the log', () => {
    runFilter(new NotFoundException('nope'), requestFor({ path: '/health', originalUrl: '/health' }));

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('derives a status from any HttpException, and 500 from anything else', () => {
    expect(RequestLoggingExceptionFilter.statusOf(new ForbiddenException('no'))).toBe(403);
    expect(RequestLoggingExceptionFilter.statusOf(new Error('boom'))).toBe(500);
    expect(RequestLoggingExceptionFilter.statusOf('a string')).toBe(500);
  });

  it('reports no elapsed time when the middleware never stamped a start', () => {
    expect(RequestLoggingExceptionFilter.elapsedSince({} as RequestWithContext)).toBeNull();
    expect(RequestLoggingExceptionFilter.elapsedSince(requestFor())).not.toBeNull();
  });
});
