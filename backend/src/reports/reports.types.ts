export type ReportKpi = {
  label: string;
  value: string;
  detail: string;
};

export type DepartmentBreakdown = {
  department: string;
  total: number;
  closed: number;
  inFlight: number;
  completionRate: number;
  avgResolutionHours: number | null;
};

export type TrendPoint = {
  period: string;
  created: number;
  closed: number;
};

export type ReportRequestRow = {
  id: string;
  requestTypeName: string;
  department: string;
  status: string;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  cycleTimeHours: number | null;
};

export interface ReportSummary {
  generatedAt: string;
  scope: 'all' | 'department' | 'requester';
  kpis: ReportKpi[];
  departments: DepartmentBreakdown[];
  trend: TrendPoint[];
  requests: ReportRequestRow[];
  totals: {
    requests: number;
    closed: number;
    inFlight: number;
    completionRate: number;
    avgResolutionHours: number | null;
  };
}
