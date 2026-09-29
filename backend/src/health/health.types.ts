export type HealthCheckResult = {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
};

export type LivenessReport = {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
  timestamp: string;
};

export type ReadinessReport = {
  status: 'ready' | 'not_ready';
  checks: { database: HealthCheckResult };
  timestamp: string;
};
