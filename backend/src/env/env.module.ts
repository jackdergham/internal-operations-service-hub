import { Global, Module } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { loadEnv } from './env.config.js';
import type { AppEnv } from './env.types.js';

export const APP_ENV = 'APP_ENV';

/**
 * Loads `.env` here rather than as a side effect of importing env.config, so
 * that loadEnv stays a pure function of the environment it is handed. A
 * deployed environment supplies the variables directly and this is a no-op.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: (): AppEnv => {
        loadDotenv();
        return loadEnv(process.env);
      },
    },
  ],
  exports: [APP_ENV],
})
export class EnvModule {}
