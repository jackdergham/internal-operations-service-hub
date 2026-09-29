import { useCallback, useEffect, useState } from 'react'
import { downloadReportCsv, fetchReportSummary } from '../api/reportsApi'
import type { ReportSummary, TrendPoint } from '../api/reportsApi'

type Props = {
  apiBaseUrl: string
  actorId: string
  showToast: (message: string) => void
}

const TREND_WIDTH = 260
const TREND_HEIGHT = 150
const TREND_PADDING = 20

function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  if (hours * 60 < 1) return '<1m'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildTrendPath(points: TrendPoint[]): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' }

  const peak = Math.max(...points.map((point) => point.created), 1)
  const step = points.length > 1 ? (TREND_WIDTH - TREND_PADDING * 2) / (points.length - 1) : 0
  const scale = (TREND_HEIGHT - TREND_PADDING * 2) / peak

  const coordinates = points.map((point, index) => {
    const x = TREND_PADDING + index * step
    const y = TREND_HEIGHT - TREND_PADDING - point.created * scale
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const line = `M${coordinates.join(' L')}`
  const baseline = TREND_HEIGHT - TREND_PADDING
  return { line, area: `${line} L${coordinates.at(-1)?.split(',')[0]},${baseline} L${coordinates[0].split(',')[0]},${baseline} Z` }
}

export default function ReportsView({ apiBaseUrl, actorId, showToast }: Props) {
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(() => {
    if (!actorId) return
    setLoading(true)
    setError('')
    fetchReportSummary(apiBaseUrl, actorId)
      .then(setReport)
      .catch((cause: unknown) => {
        setReport(null)
        setError(cause instanceof Error ? cause.message : 'The report could not be loaded.')
      })
      .finally(() => setLoading(false))
  }, [apiBaseUrl, actorId])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async () => {
    if (!actorId) return
    setExporting(true)
    try {
      const filename = `ops-report-${new Date().toISOString().slice(0, 10)}.csv`
      await downloadReportCsv(apiBaseUrl, actorId, filename)
      showToast('Exported the current report as CSV.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'The export failed.')
    } finally {
      setExporting(false)
    }
  }

  const trend = buildTrendPath(report?.trend ?? [])
  const totalCreated = report?.trend.reduce((sum, point) => sum + point.created, 0) ?? 0
  const firstPeriod = report?.trend.at(0)?.period
  const lastPeriod = report?.trend.at(-1)?.period
  const rangeLabel = firstPeriod && lastPeriod
    ? `Requests submitted, ${formatPeriod(firstPeriod)} to ${formatPeriod(lastPeriod)}`
    : 'Requests submitted, last 6 months'

  return (
    <>
      <div className="section-header-row">
        <div>
          <div className="eyebrow-label">SERVICE BENCHMARKS</div>
          <h2>Multi-Queue Telemetry &amp; Monitoring</h2>
        </div>
        <button
          type="button"
          className="secondary-action small"
          onClick={() => void handleExport()}
          disabled={!report || exporting}
        >
          <span className="material-symbols-outlined">download</span>
          <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
        </button>
      </div>

      {error && (
        <div className="report-notice" role="alert">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button type="button" className="secondary-action small" onClick={load}>Retry</button>
        </div>
      )}

      {loading && !report && (
        <div className="table-panel">
          <div className="table-header"><h3>Loading the operational report…</h3></div>
        </div>
      )}

      {!loading && !report && !error && (
        <div className="table-panel">
          <div className="table-header"><h3>Select an acting user to load the report.</h3></div>
        </div>
      )}

      {report && (
        <>
          <div className="report-kpis">
            {report.kpis.map((metric) => (
              <div key={metric.label} className="metric-card">
                <div className="metric-top">
                  <span>{metric.label}</span>
                </div>
                <div className="metric-value">{metric.value}</div>
                <div className="metric-foot">{metric.detail}</div>
              </div>
            ))}
          </div>

          <div className="analytics-grid">
            <div className="analytics-panel">
              <div className="table-header narrow">
                <h3>Department breakdown</h3>
              </div>
              {report.departments.length === 0 ? (
                <p className="report-empty">No requests in this scope yet.</p>
              ) : (
                <div className="progress-stack large">
                  {report.departments.map((department) => (
                    <div className="progress-row" key={department.department}>
                      <span>{department.department}</span>
                      <div className="bar">
                        <i style={{ width: `${department.completionRate}%` }} />
                      </div>
                      <strong>{department.completionRate}%</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="analytics-panel">
              <div className="table-header narrow">
                <h3>Submission trend</h3>
              </div>
              <svg viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`} className="sparkline" aria-label="Requests submitted per month">
                <defs>
                  <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3525cd" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3525cd" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={trend.area} fill="url(#sparklineFill)" />
                <path d={trend.line} fill="none" stroke="#3525cd" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="trend-legend">
                <span><i className="legend-dot primary" /> {rangeLabel}</span>
                <strong>{totalCreated}</strong>
              </div>
            </div>
          </div>

          <div className="table-panel">
            <div className="table-header">
              <h3>Report detail</h3>
              <span>
                {report.totals.requests} Record{report.totals.requests === 1 ? '' : 's'} · scope: {report.scope}
              </span>
            </div>
            <div className="request-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Request Type</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>First Response</th>
                    <th>Cycle Time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="report-empty">No requests match this reporting scope.</td>
                    </tr>
                  ) : report.requests.map((row) => (
                    <tr key={row.id}>
                      <td className="request-id-cell">#{row.id}</td>
                      <td>{row.requestTypeName}</td>
                      <td>{row.department}</td>
                      <td>
                        <span className="request-stage resolved">
                          <span className="material-symbols-outlined">flag</span>
                          {row.status}
                        </span>
                      </td>
                      <td className="request-muted-cell">{formatDateTime(row.createdAt)}</td>
                      <td className="request-muted-cell">{formatDateTime(row.firstResponseAt)}</td>
                      <td className="request-sla resolved">{formatHours(row.cycleTimeHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
