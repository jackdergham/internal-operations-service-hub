import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { StructuredLogger } from '../logging/structured-logger.service.js';
import type { HealthCheckResult, LivenessReport, ReadinessReport } from './health.types.js';

const SERVICE_NAME = 'internal-operations-hub';
const READINESS_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLogger,
  ) {}

  liveness(): LivenessReport {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'ok' ? 'ready' : 'not_ready',
      checks: { database },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startedAt = Date.now();

    try {
      // A real table read rather than a bare connectivity ping, so that a
      // reachable but unmigrated database is not reported as ready.
      await withTimeout(this.prisma.requestType.count(), READINESS_TIMEOUT_MS);
      return { status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.logger.warn('health.database.unreachable', { error, latencyMs });
      // The underlying reason is deliberately not echoed back: driver errors
      // embed the connection string, and this endpoint is unauthenticated.
      return { status: 'error', latencyMs, error: 'database_unreachable' };
    }
  }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Readiness probe timed out')), timeoutMs);
    timer.unref?.();
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
