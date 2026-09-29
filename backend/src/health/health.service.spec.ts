import { HealthService } from './health.service.js';
import { PrismaService } from '../prisma.service.js';
import { StructuredLogger } from '../logging/structured-logger.service.js';

const logger = new StructuredLogger();

const prismaWith = (count: () => Promise<number>) =>
  ({ requestType: { count } }) as unknown as PrismaService;

describe('HealthService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('liveness', () => {
    it('reports ok and identifies the service', () => {
      const report = new HealthService(prismaWith(async () => 0), logger).liveness();

      expect(report).toMatchObject({ status: 'ok', service: 'internal-operations-hub' });
      expect(typeof report.uptimeSeconds).toBe('number');
      expect(Number.isNaN(Date.parse(report.timestamp))).toBe(false);
    });
  });

  describe('readiness', () => {
    it('is ready when the database answers a real table read', async () => {
      const count = vi.fn().mockResolvedValue(3);

      const report = await new HealthService(prismaWith(count), logger).readiness();

      expect(count).toHaveBeenCalledOnce();
      expect(report.status).toBe('ready');
      expect(report.checks.database.status).toBe('ok');
      expect(typeof report.checks.database.latencyMs).toBe('number');
    });

    it('is not ready when the database rejects, and does not echo the driver error', async () => {
      const connectionString = 'postgres://admin:hunter2@db.internal:5432/ops';
      const count = vi.fn().mockRejectedValue(new Error(`P1001 cannot reach ${connectionString}`));

      const report = await new HealthService(prismaWith(count), logger).readiness();

      expect(report.status).toBe('not_ready');
      expect(report.checks.database).toMatchObject({ status: 'error', error: 'database_unreachable' });
      expect(JSON.stringify(report)).not.toContain(connectionString);
      expect(JSON.stringify(report)).not.toContain('hunter2');
    });

    it('is not ready when the database probe never answers', async () => {
      vi.useFakeTimers();
      try {
        const hanging = vi.fn(() => new Promise<number>(() => {}));
        const pending = new HealthService(prismaWith(hanging), logger).readiness();

        await vi.advanceTimersByTimeAsync(3_000);
        const report = await pending;

        expect(report.status).toBe('not_ready');
        expect(report.checks.database.error).toBe('database_unreachable');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
