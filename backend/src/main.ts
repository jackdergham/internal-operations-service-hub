import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { APP_ENV } from './env/env.module.js';
import type { AppEnv } from './env/env.types.js';
import { StructuredLogger } from './logging/structured-logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<AppEnv>(APP_ENV);
  const logger = new StructuredLogger();

  for (const problem of env.warnings) {
    logger.warn('config.warning', { detail: problem });
  }

  // An explicit FRONTEND_ORIGIN replaces the dev defaults rather than adding to
  // them, so a deployed instance only allows the origin it was told about.
  app.enableCors({ origin: env.frontendOrigins });

  await app.listen(env.port);
}
await bootstrap();
