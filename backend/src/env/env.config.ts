import type { AiProvider, AppEnv } from './env.types.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_PORT = 3000;
export const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const;

const AI_PROVIDERS: readonly AiProvider[] = ['local', 'gemini'];

/** Thrown once at startup, listing every problem, rather than on the first request that needs the value. */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid application configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

type EnvSource = Record<string, string | undefined>;

function read(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  const trimmed = typeof value === 'string' ? value.trim() : undefined;
  return trimmed ? trimmed : undefined;
}

function parsePort(source: EnvSource, problems: string[]): number {
  const raw = read(source, 'PORT');
  if (!raw) return DEFAULT_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT must be an integer between 1 and 65535, received "${raw}".`);
    return DEFAULT_PORT;
  }
  return port;
}

function parseAiProvider(source: EnvSource, problems: string[]): AiProvider {
  const raw = read(source, 'AI_PROVIDER');
  if (!raw) return 'local';

  if (!AI_PROVIDERS.includes(raw as AiProvider)) {
    // Previously any unrecognised value silently fell back to the local
    // provider, so a typo produced a working app with the wrong behaviour.
    problems.push(`AI_PROVIDER must be one of ${AI_PROVIDERS.join(' | ')}, received "${raw}".`);
    return 'local';
  }
  return raw as AiProvider;
}

function parseFrontendOrigins(source: EnvSource, problems: string[]): string[] {
  const raw = read(source, 'FRONTEND_ORIGIN');
  if (!raw) return [...DEFAULT_DEV_ORIGINS];

  const origins = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  const invalid = origins.filter((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
    } catch {
      // Catches the common "example.com" mistake, which a browser rejects anyway.
      return true;
    }
  });

  if (invalid.length > 0) {
    problems.push(
      `FRONTEND_ORIGIN entries must be absolute http(s) URLs, comma separated. Invalid: ${invalid.join(', ')}.`,
    );
    return [...DEFAULT_DEV_ORIGINS];
  }
  return origins;
}

function collectWarnings(source: EnvSource, aiProvider: AiProvider): string[] {
  const warnings: string[] = [];

  if (aiProvider === 'gemini' && !read(source, 'GEMINI_API_KEY')) {
    warnings.push(
      'AI_PROVIDER is "gemini" but GEMINI_API_KEY is not set; request assistance will fall back to the deterministic local provider.',
    );
  }
  if (aiProvider === 'local') {
    warnings.push('AI_PROVIDER is "local"; request assistance uses the deterministic provider and makes no external AI calls.');
  }
  return warnings;
}

/**
 * Resolves and validates configuration once, at startup. Anything wrong that
 * would otherwise fail silently later — a missing database URL, a misspelled
 * AI_PROVIDER, a CORS origin without a scheme — is raised here instead.
 */
export function loadEnv(source: EnvSource): AppEnv {
  const problems: string[] = [];

  const databaseUrl = read(source, 'DATABASE_URL');
  if (!databaseUrl) problems.push('DATABASE_URL is required. Set it to a Prisma connection string.');

  const aiProvider = parseAiProvider(source, problems);
  const port = parsePort(source, problems);
  const frontendOrigins = parseFrontendOrigins(source, problems);

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    databaseUrl: databaseUrl as string,
    port,
    aiProvider,
    geminiApiKey: read(source, 'GEMINI_API_KEY'),
    geminiModel: read(source, 'GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL,
    frontendOrigins,
    warnings: collectWarnings(source, aiProvider),
  };
}
