import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { StructuredLogger } from '../logging/structured-logger.service.js';

const run = promisify(execFile);

const SCHEMA_ARG = '--schema=./prisma/schema.prisma';

/**
 * Creates the database schema before the application accepts traffic.
 *
 * This exists because a container platform's deploy hooks are not a reliable
 * place to run migrations: they can be skipped entirely on a first deployment,
 * and whether they run at all depends on the platform's configuration being
 * honoured. Doing it here means the schema is guaranteed to exist in the same
 * process, resolving the same DATABASE_URL, as the code that queries it.
 *
 * Runs only when NODE_ENV=production, which the runtime image already sets, so
 * no extra platform configuration is required and neither local development nor
 * CI is affected.
 *
 * The seed is conditional: it runs only when the database has no request types,
 * so a first boot populates the demo data while a later restart preserves
 * whatever state the running instance had reached.
 */
export async function ensureSchema(logger: StructuredLogger): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  await run('npx', ['prisma', 'db', 'push', SCHEMA_ARG, '--skip-generate'], {
    env: process.env,
  });
  logger.info('schema.pushed', { schema: './prisma/schema.prisma' });

  const prisma = new PrismaClient();
  try {
    const requestTypeCount = await prisma.requestType.count();
    if (requestTypeCount > 0) {
      logger.info('schema.seed.skipped', { reason: 'database already populated', requestTypeCount });
      return;
    }
  } finally {
    await prisma.$disconnect();
  }

  await run('npx', ['prisma', 'db', 'seed', SCHEMA_ARG], { env: process.env });
  logger.info('schema.seeded', {});
}
