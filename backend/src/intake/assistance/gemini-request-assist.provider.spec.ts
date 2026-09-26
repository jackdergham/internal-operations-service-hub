import { GeminiRequestAssistProvider } from './gemini-request-assist.provider.js';
import { LocalRequestAssistProvider } from './local-request-assist.provider.js';

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
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
  });

  it('returns a validated Gemini suggestion', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(geminiSuggestion) }] } }],
    }), { status: 200 }));

    const provider = new GeminiRequestAssistProvider(new LocalRequestAssistProvider());
    const result = await provider.suggest('I need PTO from 2026-10-12 to 2026-10-16.');

    expect(result).toEqual({ ...geminiSuggestion, source: 'gemini' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('generateContent?key=test-key');
  });

  it('falls back when Gemini returns malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{not-json' }] } }],
    }), { status: 200 }));

    const provider = new GeminiRequestAssistProvider(new LocalRequestAssistProvider());
    const result = await provider.suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings[0]).toContain('Gemini assistance was unavailable');
    expect(result.requestTypeId).toBe('new-laptop');
  });

  it('falls back when Gemini returns an HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('service unavailable', { status: 503 }));

    const provider = new GeminiRequestAssistProvider(new LocalRequestAssistProvider());
    const result = await provider.suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings[0]).toContain('Gemini assistance was unavailable');
  });

  it('uses the local provider without calling Gemini when the key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const provider = new GeminiRequestAssistProvider(new LocalRequestAssistProvider());
    const result = await provider.suggest('I need a laptop for development work.');

    expect(result.source).toBe('local');
    expect(result.warnings).not.toContain(expect.stringContaining('Gemini assistance was unavailable'));
    expect(fetch).not.toHaveBeenCalled();
  });
});
