import { BadRequestException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';
import { StructuredLogger } from './structured-logger.service.js';
import type { RequestWithContext } from './request-id.middleware.js';

function contextFor(request: unknown, statusCode = 200) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode }) }),
  } as unknown as ExecutionContext;
}

function requestFor(overrides: Partial<RequestWithContext> = {}): RequestWithContext {
  return {
    method: 'POST',
    originalUrl: '/routing-decisions/decision-1/steps/step-1/decision',
    path: '/routing-decisions/decision-1/steps/step-1/decision',
    requestId: 'req-42',
    startedAt: Date.now(),
    actor: { employeeId: 'manager-1', name: 'Rania Haddad', department: 'IT', managerId: null, roles: ['approver'] },
    ...overrides,
  } as RequestWithContext;
}

const successHandler: CallHandler = { handle: () => of('ok') };

describe('RequestLoggingInterceptor', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const lastRecord = () => JSON.parse(vi.mocked(log).mock.calls[0][0] as string) as Record<string, unknown>;

  const intercept = (request: RequestWithContext, handler: CallHandler, statusCode = 200) =>
    lastValueFrom(new RequestLoggingInterceptor(new StructuredLogger()).intercept(contextFor(request, statusCode), handler));

  it('records the completed request with its correlation id and authenticated actor', async () => {
    await intercept(requestFor(), successHandler, 201);

    expect(log).toHaveBeenCalledOnce();
    const record = lastRecord();
    expect(record).toMatchObject({
      event: 'http.request.completed',
      requestId: 'req-42',
      method: 'POST',
      statusCode: 201,
      actorId: 'manager-1',
    });
    expect(typeof record.durationMs).toBe('number');
  });

  it('records a null actor for an unauthenticated request', async () => {
    await intercept(requestFor({ actor: undefined }), successHandler);

    expect(lastRecord().actorId).toBeNull();
  });

  it('propagates a handler failure without logging it, leaving that to the filter', async () => {
    const failing: CallHandler = { handle: () => throwError(() => new BadRequestException('bad input')) };

    await expect(intercept(requestFor(), failing)).rejects.toThrow(BadRequestException);
    expect(log).not.toHaveBeenCalled();
  });

  it('skips health paths so platform polling does not dominate the log', async () => {
    await intercept(requestFor({ path: '/health', originalUrl: '/health', method: 'GET' }), successHandler);

    expect(log).not.toHaveBeenCalled();
  });
});
