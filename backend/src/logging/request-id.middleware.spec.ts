import type { Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware.js';
import type { RequestWithContext } from './request-id.middleware.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function run(header?: string | string[]) {
  const headers = header === undefined ? {} : { 'x-request-id': header };
  const request = { headers } as unknown as RequestWithContext;
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as Response;
  const next = vi.fn();

  new RequestIdMiddleware().use(request, response, next);

  return { requestId: request.requestId, setHeader, next };
}

describe('RequestIdMiddleware', () => {
  it('assigns a uuid and echoes it on the response when no id is supplied', () => {
    const { requestId, setHeader, next } = run();

    expect(requestId).toMatch(UUID_PATTERN);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('reuses an inbound id so a caller trace can be followed end to end', () => {
    const { requestId, setHeader } = run('trace-abc-123');

    expect(requestId).toBe('trace-abc-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-abc-123');
  });

  it('falls back to a fresh id for a blank header', () => {
    expect(run('   ').requestId).toMatch(UUID_PATTERN);
    expect(run('').requestId).toMatch(UUID_PATTERN);
  });

  it('uses the first value when the header arrives repeated', () => {
    expect(run(['first-id', 'second-id']).requestId).toBe('first-id');
  });

  it('truncates an oversized id instead of trusting unbounded input', () => {
    const { requestId } = run('x'.repeat(500));

    expect(requestId).toHaveLength(128);
  });
});
