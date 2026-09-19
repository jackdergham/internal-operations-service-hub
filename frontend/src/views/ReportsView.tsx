import { reportMetrics } from '../data'

type Props = {
  showToast: (message: string) => void
}

export default function ReportsView({ showToast }: Props) {
  return (
    <>
      <div className="section-header-row">
        <div>
          <div className="eyebrow-label">SERVICE BENCHMARKS</div>
          <h2>Multi-Queue Telemetry &amp; SLA Monitoring</h2>
        </div>
        <button type="button" className="secondary-action small" onClick={() => showToast('Exported operational report')}>
          <span className="material-symbols-outlined">download</span>
          <span>Export CSV</span>
        </button>
      </div>

      <div className="report-kpis">
        {reportMetrics.map((metric) => (
          <div key={metric.label} className="metric-card">
            <div className="metric-top">
              <span>{metric.label}</span>
              <span className="delta positive">{metric.delta}</span>
            </div>
            <div className="metric-value">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="analytics-grid">
        <div className="analytics-panel">
          <div className="table-header narrow">
            <h3>Department breakdown</h3>
          </div>
          <div className="progress-stack large">
            {[
              ['IT & Hardware', 78],
              ['People & HR', 56],
              ['Facilities', 41],
              ['Finance', 34],
              ['Legal', 25],
              ['Security', 67],
            ].map(([label, value]) => (
              <div className="progress-row" key={label as string}>
                <span>{label as string}</span>
                <div className="bar"><i style={{ width: `${value}%` }} /></div>
                <strong>{value}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-panel">
          <div className="table-header narrow">
            <h3>Response trend</h3>
          </div>
          <svg viewBox="0 0 260 150" className="sparkline" aria-label="SLA trend chart">
            <defs>
              <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3525cd" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3525cd" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,120 C42,112 60,90 80,94 S130,78 150,70 S200,54 260,20 L260,150 L0,150 Z" fill="url(#sparklineFill)" />
            <path d="M0,120 C42,112 60,90 80,94 S130,78 150,70 S200,54 260,20" fill="none" stroke="#3525cd" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="trend-legend">
            <span><i className="legend-dot primary" /> Avg cycle time</span>
            <strong>6.8h</strong>
          </div>
        </div>
      </div>
    </>
  )
}
