export type ReportKpi = {
  label: string
  value: string
  detail: string
}

export type DepartmentBreakdown = {
  department: string
  total: number
  closed: number
  inFlight: number
  completionRate: number
  avgResolutionHours: number | null
}

export type TrendPoint = {
  period: string
  created: number
  closed: number
}

export type ReportRequestRow = {
  id: string
  requestTypeName: string
  department: string
  status: string
  createdAt: string
  firstResponseAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  cycleTimeHours: number | null
}

export type ReportSummary = {
  generatedAt: string
  scope: 'all' | 'department' | 'requester'
  kpis: ReportKpi[]
  departments: DepartmentBreakdown[]
  trend: TrendPoint[]
  requests: ReportRequestRow[]
  totals: {
    requests: number
    closed: number
    inFlight: number
    completionRate: number
    avgResolutionHours: number | null
  }
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string }
  return new Error(payload.message ?? fallback)
}

export async function fetchReportSummary(apiBaseUrl: string, actorId: string): Promise<ReportSummary> {
  const response = await fetch(`${apiBaseUrl}/reports/summary`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw await readError(response, 'The report could not be loaded.')
  return response.json() as Promise<ReportSummary>
}

export async function downloadReportCsv(apiBaseUrl: string, actorId: string, filename: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/reports/export.csv`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw await readError(response, 'The report could not be exported.')

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
