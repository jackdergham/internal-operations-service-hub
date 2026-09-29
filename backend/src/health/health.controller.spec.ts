import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import type { LivenessReport, ReadinessReport } from './health.types.js';
import type { Response } from 'express';

const livenessReport: LivenessReport = {
  status: 'ok',
  service: 'internal-operations-hub',
  uptimeSeconds: 12,
  timestamp: '2026-09-29T12:00:00.000Z',
};

const readyReport: ReadinessReport = {
  status: 'ready',
  checks: { database: { status: 'ok', latencyMs: 4 } },
  timestamp: '2026-09-29T12:00:00.000Z',
};

const notReadyReport: ReadinessReport = {
  status: 'not_ready',
  checks: { database: { status: 'error', latencyMs: 3000, error: 'database_unreachable' } },
  timestamp: '2026-09-29T12:00:00.000Z',
};

function controllerWith(readiness: () => Promise<ReadinessReport>) {
  const status = vi.fn();
  const service = {
    liveness: () => livenessReport,
    readiness,
  } as unknown as HealthService;

  return { controller: new HealthController(service), response: { status } as unknown as Response, status };
}

describe('HealthController', () => {
  it('returns the liveness report unchanged', () => {
    const { controller } = controllerWith(async () => readyReport);

    expect(controller.liveness()).toEqual(livenessReport);
  });

  it('leaves the status alone when the service is ready', async () => {
    const { controller, response, status } = controllerWith(async () => readyReport);

    const report = await controller.readiness(response);

    expect(report.status).toBe('ready');
    expect(status).not.toHaveBeenCalled();
  });

  it('answers 503 when the service is not ready, so a platform can act on it', async () => {
    const { controller, response, status } = controllerWith(async () => notReadyReport);

    const report = await controller.readiness(response);

    expect(report).toEqual(notReadyReport);
    expect(status).toHaveBeenCalledWith(503);
  });
});
