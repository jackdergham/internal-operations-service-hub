import { ConfigError, DEFAULT_GEMINI_MODEL, DEFAULT_PORT, loadEnv } from './env.config.js';

const valid = { DATABASE_URL: 'postgresql://iosh:iosh@localhost:5433/iosh' } as Record<string, string | undefined>;

const load = (overrides: Record<string, string | undefined> = {}) => loadEnv({ ...valid, ...overrides });

describe('loadEnv', () => {
  it('accepts a minimal environment and fills in every default', () => {
    expect(load()).toEqual({
      databaseUrl: 'postgresql://iosh:iosh@localhost:5433/iosh',
      port: DEFAULT_PORT,
      aiProvider: 'local',
      geminiApiKey: undefined,
      geminiModel: DEFAULT_GEMINI_MODEL,
      frontendOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      warnings: [expect.stringContaining('deterministic provider')],
    });
  });

  describe('required values', () => {
    it('refuses to start without a database url', () => {
      expect(() => loadEnv({})).toThrow(ConfigError);
      expect(() => loadEnv({})).toThrow(/DATABASE_URL is required/);
    });

    it('treats a blank database url as absent', () => {
      expect(() => load({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL is required/);
    });
  });

  describe('AI_PROVIDER', () => {
    it('defaults to the deterministic local provider', () => {
      expect(load().aiProvider).toBe('local');
    });

    it('accepts an explicit gemini', () => {
      const env = load({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' });
      expect(env.aiProvider).toBe('gemini');
      expect(env.geminiApiKey).toBe('k');
    });

    it('rejects a misspelled provider instead of silently using local', () => {
      // Previously any unrecognised value quietly behaved as `local`, so a typo
      // produced a working app with the wrong behaviour.
      expect(() => load({ AI_PROVIDER: 'gimini' })).toThrow(/AI_PROVIDER must be one of local \| gemini/);
    });
  });

  describe('PORT', () => {
    it('parses a valid port', () => {
      expect(load({ PORT: '8080' }).port).toBe(8080);
    });

    it.each(['abc', '0', '70000', '80.5', '-1'])('rejects PORT=%s', (port) => {
      expect(() => load({ PORT: port })).toThrow(/PORT must be an integer/);
    });
  });

  describe('GEMINI_MODEL', () => {
    it('defaults when unset', () => {
      expect(load().geminiModel).toBe(DEFAULT_GEMINI_MODEL);
    });

    it('uses the configured model', () => {
      expect(load({ GEMINI_MODEL: 'gemini-9.9-pro' }).geminiModel).toBe('gemini-9.9-pro');
    });
  });

  describe('FRONTEND_ORIGIN', () => {
    it('defaults to the two dev origins', () => {
      expect(load().frontendOrigins).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    });

    it('parses a comma separated list', () => {
      expect(load({ FRONTEND_ORIGIN: 'https://ops.example.com, https://admin.example.com' }).frontendOrigins)
        .toEqual(['https://ops.example.com', 'https://admin.example.com']);
    });

    it('replaces the dev defaults rather than adding to them', () => {
      expect(load({ FRONTEND_ORIGIN: 'https://ops.example.com' }).frontendOrigins)
        .not.toContain('http://localhost:5173');
    });

    it('rejects an origin without a scheme, which a browser would reject anyway', () => {
      expect(() => load({ FRONTEND_ORIGIN: 'ops.example.com' }))
        .toThrow(/absolute http\(s\) URLs/);
    });

    it('rejects a non-http scheme', () => {
      expect(() => load({ FRONTEND_ORIGIN: 'ftp://ops.example.com' }))
        .toThrow(/absolute http\(s\) URLs/);
    });
  });

  describe('warnings', () => {
    it('warns when gemini is selected without a key, but still starts', () => {
      const env = load({ AI_PROVIDER: 'gemini' });

      expect(env.aiProvider).toBe('gemini');
      expect(env.warnings).toEqual([expect.stringContaining('GEMINI_API_KEY is not set')]);
    });

    it('does not warn about a missing key once it is set', () => {
      expect(load({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }).warnings).toEqual([]);
    });
  });

  it('reports every problem at once rather than one per restart', () => {
    let caught: ConfigError | undefined;
    try {
      loadEnv({ AI_PROVIDER: 'gimini', PORT: 'abc' });
    } catch (error) {
      caught = error as ConfigError;
    }

    expect(caught).toBeInstanceOf(ConfigError);
    expect(caught?.problems).toHaveLength(3);
    expect(caught?.message).toContain('DATABASE_URL');
    expect(caught?.message).toContain('AI_PROVIDER');
    expect(caught?.message).toContain('PORT');
  });
});
