export type AiProvider = 'local' | 'gemini';

export type AppEnv = {
  /** Required. Prisma reads this itself, but failing at boot is clearer than failing on first query. */
  databaseUrl: string;
  port: number;
  aiProvider: AiProvider;
  /** Optional: without it the deterministic local provider is used. */
  geminiApiKey: string | undefined;
  geminiModel: string;
  /** Exact CORS allow-list. Defaults to the two Vite dev origins when unset. */
  frontendOrigins: string[];
  /**
   * Directory of built frontend assets to serve, or undefined to serve the API
   * only. A single deployment serves both, which is why this exists.
   */
  staticDir: string | undefined;
  /** Non-fatal configuration problems, surfaced once at startup. */
  warnings: string[];
};
