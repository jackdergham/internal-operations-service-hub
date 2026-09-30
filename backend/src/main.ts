import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { APP_ENV } from './env/env.module.js';
import type { AppEnv } from './env/env.types.js';
import { StructuredLogger } from './logging/structured-logger.service.js';
import { ensureSchema } from './ops/schema-bootstrap.js';

async function bootstrap() {
  const logger = new StructuredLogger();

  // The schema must exist before Nest initialises, because RoutingService reads
  // the request table in its onModuleInit hook. This runs before the app is
  // created so a missing table can never reach that hook.
  await ensureSchema(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<AppEnv>(APP_ENV);

  for (const problem of env.warnings) {
    logger.warn('config.warning', { detail: problem });
  }

  // An explicit FRONTEND_ORIGIN replaces the dev defaults rather than adding to
  // them, so a deployed instance only allows the origin it was told about. A
  // single-service deployment serves the app and the API from one origin and
  // needs no allow-list at all, so this stays unset there.
  app.enableCors({ origin: env.frontendOrigins });

  // Serving the built frontend from the API means one deployment, one URL and no
  // CORS, at the cost of a rebuild whenever the frontend changes. The directory
  // is optional: unset locally so `vite dev` keeps serving the app.
  if (env.staticDir) {
    const staticPath = resolve(env.staticDir);
    if (existsSync(staticPath)) {
      // fallthrough is explicit: a miss must fall through to the Nest router so
      // that API paths are not intercepted by the asset handler.
      app.useStaticAssets(staticPath, { fallthrough: true });
      logger.info('static.serving', { path: staticPath });
    } else {
      // Not fatal: the API is still fully usable, so this warns rather than
      // aborting the boot and taking the health check down with it.
      logger.warn('static.missing', { path: staticPath });
    }
  }

  await app.listen(env.port);
}
await bootstrap();
