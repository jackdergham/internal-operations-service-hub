import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../directory/directory.types.js';
import type {
  DepartmentBreakdown,
  ReportKpi,
  ReportRequestRow,
  ReportSummary,
  TrendPoint,
} from './reports.types.js';

const TREND_MONTHS = 6;
const HOUR_MS = 60 * 60 * 1000;

const CSV_COLUMNS = [
  'Request ID',
  'Request Type',
  'Department',
  'Status',
  'Submitted',
  'First Response',
  'Resolved',
  'Closed',
  'Cycle Time (hours)',
] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSummary(actor: Actor): Promise<ReportSummary> {
    const scope = this.scopeFor(actor);
    const requests = await this.prisma.request.findMany({
      where: scope.where,
      include: {
        requestType: { select: { name: true, department: true } },
        statusEvents: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows: ReportRequestRow[] = requests.map((request: (typeof requests)[number]) => {
      const firstResponse =
        request.statusEvents.find((event: (typeof request.statusEvents)[number]) => event.status !== 'Submitted') ??
        null;
      const resolved =
        request.statusEvents.find((event: (typeof request.statusEvents)[number]) => event.status === 'Resolved') ??
        null;
      const closed =
        request.statusEvents.find((event: (typeof request.statusEvents)[number]) => event.status === 'Closed') ?? null;
      const settledAt = resolved ?? closed;

      return {
        id: request.id,
        requestTypeName: request.requestType.name,
        department: request.requestType.department,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        firstResponseAt: firstResponse ? firstResponse.createdAt.toISOString() : null,
        resolvedAt: resolved ? resolved.createdAt.toISOString() : null,
        closedAt: closed ? closed.createdAt.toISOString() : null,
        cycleTimeHours: settledAt
          ? round((settledAt.createdAt.getTime() - request.createdAt.getTime()) / HOUR_MS, 2)
          : null,
      };
    });

    const settled = rows.filter((row) => row.cycleTimeHours !== null);
    const closed = rows.filter((row) => row.closedAt !== null);
    const completionRate = rows.length === 0 ? 0 : (closed.length / rows.length) * 100;
    const avgResolutionHours = average(settled.map((row) => row.cycleTimeHours as number));

    return {
      generatedAt: new Date().toISOString(),
      scope: scope.kind,
      kpis: this.buildKpis({ total: rows.length, closed: closed.length, completionRate, avgResolutionHours }),
      departments: this.buildDepartments(rows),
      trend: this.buildTrend(rows),
      requests: rows,
      totals: {
        requests: rows.length,
        closed: closed.length,
        inFlight: rows.length - closed.length,
        completionRate: round(completionRate, 1),
        avgResolutionHours: avgResolutionHours === null ? null : round(avgResolutionHours, 2),
      },
    };
  }

  async buildCsv(actor: Actor): Promise<string> {
    const summary = await this.buildSummary(actor);
    const lines = [
      CSV_COLUMNS.join(','),
      ...summary.requests.map((row) =>
        [
          row.id,
          row.requestTypeName,
          row.department,
          row.status,
          row.createdAt,
          row.firstResponseAt ?? '',
          row.resolvedAt ?? '',
          row.closedAt ?? '',
          row.cycleTimeHours === null ? '' : row.cycleTimeHours.toString(),
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    return lines.join('\n');
  }

  private buildKpis(input: {
    total: number;
    closed: number;
    completionRate: number;
    avgResolutionHours: number | null;
  }): ReportKpi[] {
    return [
      {
        label: 'Requests tracked',
        value: String(input.total),
        detail: 'In the selected reporting scope',
      },
      {
        label: 'Closed requests',
        value: String(input.closed),
        detail: `${input.total - input.closed} still in flight`,
      },
      {
        label: 'Completion rate',
        value: `${round(input.completionRate, 1)}%`,
        detail: 'Closed as a share of all requests',
      },
      {
        label: 'Avg resolution time',
        value: input.avgResolutionHours === null ? '—' : formatHours(input.avgResolutionHours),
        detail: 'Submission to resolved or closed',
      },
    ];
  }

  private buildDepartments(rows: ReportRequestRow[]): DepartmentBreakdown[] {
    const byDepartment = new Map<string, ReportRequestRow[]>();
    for (const row of rows) {
      const bucket = byDepartment.get(row.department);
      if (bucket) bucket.push(row);
      else byDepartment.set(row.department, [row]);
    }

    return [...byDepartment.entries()]
      .map(([department, departmentRows]) => {
        const closedRows = departmentRows.filter((row) => row.closedAt !== null);
        const resolvedRows = departmentRows.filter((row) => row.cycleTimeHours !== null);
        return {
          department,
          total: departmentRows.length,
          closed: closedRows.length,
          inFlight: departmentRows.length - closedRows.length,
          completionRate:
            departmentRows.length === 0 ? 0 : round((closedRows.length / departmentRows.length) * 100, 1),
          avgResolutionHours: average(resolvedRows.map((row) => row.cycleTimeHours as number)),
        };
      })
      .sort((a, b) => b.total - a.total || a.department.localeCompare(b.department));
  }

  private buildTrend(rows: ReportRequestRow[]): TrendPoint[] {
    const now = new Date();
    const points: TrendPoint[] = [];

    for (let offset = TREND_MONTHS - 1; offset >= 0; offset -= 1) {
      const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 1));
      const key = periodKey(cursor);

      points.push({
        period: key,
        created: rows.filter((row) => withinRange(row.createdAt, cursor, next)).length,
        closed: rows.filter((row) => row.closedAt !== null && withinRange(row.closedAt, cursor, next)).length,
      });
    }

    return points;
  }

  private scopeFor(actor: Actor): { kind: ReportSummary['scope']; where: Prisma.RequestWhereInput } {
    if (actor.roles.includes('admin')) return { kind: 'all', where: {} };
    if (actor.roles.includes('fulfiller') || actor.roles.includes('approver')) {
      return { kind: 'department', where: { requestType: { department: actor.department } } };
    }
    return { kind: 'requester', where: { requesterId: actor.employeeId } };
  }
}

function withinRange(iso: string, start: Date, end: Date): boolean {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function periodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatHours(hours: number): string {
  if (hours * 60 < 1) return 'under 1m';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${round(hours, 1)}h`;
  return `${round(hours / 24, 1)}d`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
