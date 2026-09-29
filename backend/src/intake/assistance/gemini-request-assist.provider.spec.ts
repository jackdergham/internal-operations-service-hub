import { GeminiRequestAssistProvider } from './gemini-request-assist.provider.js';
import { LocalRequestAssistProvider } from './local-request-assist.provider.js';
import { StructuredLogger } from '../../logging/structured-logger.service.js';
import type { AppEnv } from '../../env/env.types.js';

const envFor = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  databaseUrl: 'postgresql://iosh:iosh@localhost:5433/iosh',
  port: 3000,
  aiProvider: 'gemini',
  geminiApiKey: 'test-key',
  geminiModel: 'gemini-test-model',
  frontendOrigins: [],
  warnings: [],
  ...overrides,
});

const buildProvider = (overrides: Partial<AppEnv> = {}) =>
  new GeminiRequestAssistProvider(
    new LocalRequestAssistProvider(),
    envFor(overrides),
    new StructuredLogger(),
  );

const geminiSuggestion = {
  requestTypeId: 'pto-request',
  formData: {
    startDate: '2026-10-12',
    endDate: '2026-10-16',
  },
  missingFields: [],
  warnings: [],
  confidence: 'high',
};

describe('GeminiRequestAssistProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a validated Gemini suggestion', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(geminiSuggestion) }] } }],
    }), { status: 200 }));

    const result = await buildProvider().suggest('I need PTO from 2026-10-12 to 2026-10-16.');

    expect(result).toEqual({ ...geminiSuggestion, source: 'gemini' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('generateContent?key=test-key');
  });

  it('uses the configured model rather than a built-in default', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(geminiSuggestion) }] } }],
    }), { status: 200 }));

    await buildProvider({ geminiModel: 'gemini-9.9-pro' }).suggest('I need a laptop for development work.');

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('models/gemini-9.9-pro:generateContent');
  });

  it('falls back when Gemini returns malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{not-json' }] } }],
    }), { status: 200 }));

    const result = await buildProvider().suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings[0]).toContain('Gemini assistance was unavailable');
    expect(result.requestTypeId).toBe('new-laptop');
  });

  it('falls back when Gemini returns an HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('service unavailable', { status: 503 }));

    const result = await buildProvider().suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings[0]).toContain('Gemini assistance was unavailable');
  });

  it('uses the local provider without calling Gemini when the key is absent', async () => {
    const result = await buildProvider({ geminiApiKey: undefined })
      .suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings).not.toContain(expect.stringContaining('Gemini assistance was unavailable'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records a fallback event that leaks neither the api key nor the request text', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('service unavailable', { status: 503 }));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await buildProvider().suggest('I need a laptop for development work.');

    expect(warn).toHaveBeenCalledOnce();
    const event = JSON.parse(vi.mocked(warn).mock.calls[0][0] as string) as Record<string, unknown>;
    expect(event.event).toBe('assist.provider.fallback');
    expect(event.reason).toBe('provider_http_error');
    expect(event.fallback).toBe('local');

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('test-key');
    expect(serialized).not.toContain('development work');
  });

  it('records an informational event when the key is absent, without flagging the request as degraded', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await buildProvider({ geminiApiKey: undefined }).suggest('I need a laptop for development work.');

    expect(log).toHaveBeenCalledOnce();
    const event = JSON.parse(vi.mocked(log).mock.calls[0][0] as string) as Record<string, unknown>;
    expect(event.event).toBe('assist.provider.fallback');
    expect(event.reason).toBe('missing_api_key');
  });
});
