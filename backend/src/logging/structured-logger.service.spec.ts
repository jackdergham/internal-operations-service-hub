import { StructuredLogger } from './structured-logger.service.js';

function capture() {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((line) => { lines.push(String(line)); });
  vi.spyOn(console, 'warn').mockImplementation((line) => { lines.push(String(line)); });
  vi.spyOn(console, 'error').mockImplementation((line) => { lines.push(String(line)); });

  return {
    lines,
    last: () => JSON.parse(lines.at(-1) ?? '{}') as Record<string, unknown>,
  };
}

describe('StructuredLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes one JSON line carrying a timestamp, the level and the event', () => {
    const { lines } = capture();

    new StructuredLogger().info('http.request.completed', { method: 'GET' });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(record).toMatchObject({ level: 'info', event: 'http.request.completed', method: 'GET' });
    expect(Number.isNaN(Date.parse(record.timestamp as string))).toBe(false);
  });

  it('routes each level to its own console stream', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new StructuredLogger();
    logger.info('a');
    logger.warn('b');
    logger.error('c');

    expect(log).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('replaces values whose field name looks like a credential', () => {
    const { last } = capture();

    new StructuredLogger().info('test', {
      GEMINI_API_KEY: 'super-secret-value',
      authorization: 'Bearer abc123',
      nested: { dbPassword: 'hunter2', safe: 'visible' },
    });

    expect(last()).toMatchObject({
      GEMINI_API_KEY: '[redacted]',
      authorization: '[redacted]',
      nested: { dbPassword: '[redacted]', safe: 'visible' },
    });
  });

  it('masks inline secrets that leak through free text', () => {
    const { last } = capture();

    new StructuredLogger().warn('provider.failed', {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=abc123&alt=sse',
    });

    expect(last().url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=[redacted]&alt=sse',
    );
  });

  it('masks credentials embedded in a url authority', () => {
    const { last } = capture();

    new StructuredLogger().error('db.failed', { detail: 'cannot reach postgres://admin:hunter2@db.internal:5432/ops' });

    expect(last().detail).toBe('cannot reach postgres://[redacted]@db.internal:5432/ops');
  });

  it('serializes an Error as name and message, and masks secrets inside the message', () => {
    const { last } = capture();

    new StructuredLogger().warn('provider.failed', { error: new TypeError('fetch failed for url ...?key=abc123') });

    expect(last().error).toEqual({ name: 'TypeError', message: 'fetch failed for url ...?key=[redacted]' });
  });

  it('omits undefined fields and survives circular structures', () => {
    const { last } = capture();
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    new StructuredLogger().info('test', { absent: undefined, circular });

    expect(last()).toMatchObject({ circular: { name: 'loop', self: '[circular]' } });
    expect(last()).not.toHaveProperty('absent');
  });
});
