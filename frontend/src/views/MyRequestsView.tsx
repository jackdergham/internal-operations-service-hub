import type { RequestSummary } from '../api/intakeApi'

// Canonical lifecycle from data-model.md's Request Intake & Lifecycle section:
// Submitted -> Pending Approval -> Approved -> In Progress -> Resolved -> Closed
// (Pending Approval -> Rejected is a terminal branch off that line, not a step on it.)
const STAGES = ['Submitted', 'Pending Approval', 'Approved', 'In Progress', 'Resolved', 'Closed'] as const
const STAGE_ICONS: Record<string, string> = {
  Submitted: 'task_alt',
  'Pending Approval': 'pending',
  Approved: 'check',
  'In Progress': 'sync',
  Resolved: 'check_circle',
  Closed: 'lock',
}

type Tone = 'pending' | 'active' | 'resolved' | 'rejected'

function toneFor(status: string): Tone {
  if (status === 'Rejected') return 'rejected'
  if (status === 'Resolved' || status === 'Closed') return 'resolved'
  if (status === 'In Progress') return 'active'
  return 'pending'
}

function iconFor(status: string): string {
  if (status === 'Rejected') return 'cancel'
  if (status === 'Resolved' || status === 'Closed') return 'check_circle'
  if (status === 'In Progress') return 'sync'
  return 'pending'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function eventTimeFor(request: RequestSummary, stage: string): string | null {
  const event = request.statusEvents.find((candidate) => candidate.status === stage)
  return event ? formatDate(event.createdAt) : null
}

type Props = {
  requests: RequestSummary[]
  loading: boolean
}

export default function MyRequestsView({ requests, loading }: Props) {
  if (loading) {
    return (
      <div className="table-panel">
        <div className="table-header"><h3>Loading your requests…</h3></div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="table-panel">
        <div className="table-header">
          <h3>Submissions History &amp; Status</h3>
          <span>0 Records Found</span>
        </div>
        <div className="request-table-scroll">
          <p style={{ padding: '1.5rem' }}>
            No requests yet. Submit one from the Catalog to see its progress here.
          </p>
        </div>
      </div>
    )
  }

  // The tracker panel visualizes one request's progress in detail; the most
  // recently submitted one is the most likely to be worth watching closely.
  const tracked = requests[0]
  const rejected = tracked.status === 'Rejected'
  const currentStageIndex = rejected
    ? STAGES.indexOf('Pending Approval')
    : (STAGES as readonly string[]).indexOf(tracked.status)

  return (
    <>
      <div className="tracker-panel">
        <div className="panel-header tracker-header">
          <div>
            <div className="eyebrow-label">TICKET TRACKER</div>
            <h2>{tracked.requestTypeName} — #{tracked.id}</h2>
          </div>
          <span className={`mini-badge ${rejected ? 'warning' : 'info'}`}>
            {rejected
              ? 'Rejected'
              : `Step ${currentStageIndex + 1} of ${STAGES.length}${tracked.status === 'Closed' ? '' : ' — ' + tracked.status}`}
          </span>
        </div>

        <div className="step-grid">
          {STAGES.map((stage, index) => {
            const isComplete = !rejected && index < currentStageIndex
            const isActive = !rejected && index === currentStageIndex
            const isFuture = rejected ? index > STAGES.indexOf('Pending Approval') : index > currentStageIndex
            const time = eventTimeFor(tracked, stage)

            return (
              <div
                key={stage}
                className={`step-item ${isComplete ? 'complete' : ''} ${isActive ? 'current' : ''} ${isFuture ? 'light' : ''}`}
              >
                <div className={`step-bullet ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''}`}>
                  <span className="material-symbols-outlined">{STAGE_ICONS[stage]}</span>
                </div>
                <strong>{stage}</strong>
                <span>{time ?? (isFuture ? 'Not yet reached' : 'Pending')}</span>
              </div>
            )
          })}
          {rejected && (
            <div className="step-item current">
              <div className="step-bullet active">
                <span className="material-symbols-outlined">cancel</span>
              </div>
              <strong>Rejected</strong>
              <span>{eventTimeFor(tracked, 'Rejected') ?? 'Pending'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="table-panel">
        <div className="table-header">
          <h3>Submissions History &amp; Status</h3>
          <span>{requests.length} Record{requests.length === 1 ? '' : 's'} Found</span>
        </div>

        <div className="request-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title &amp; Classification</th>
                <th>Submitted</th>
                <th>Current Stage</th>
                <th>Last Update</th>
                <th className="request-action-heading">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((row) => {
                const tone = toneFor(row.status)
                const lastEvent = row.statusEvents.at(-1)

                return (
                  <tr key={row.id}>
                    <td className="request-id-cell">#{row.id}</td>
                    <td>
                      <div className="request-cell">
                        <strong>{row.requestTypeName}</strong>
                        <span>{row.department}</span>
                      </div>
                    </td>
                    <td className="request-muted-cell">{formatDate(row.createdAt)}</td>
                    <td>
                      <span className={`request-stage ${tone}`}>
                        <span className="material-symbols-outlined">{iconFor(row.status)}</span>
                        {row.status}
                      </span>
                    </td>
                    <td className={`request-sla ${tone}`}>
                      {lastEvent ? formatDate(lastEvent.createdAt) : '—'}
                    </td>
                    <td className="request-action-cell">
                      <span className="request-action">
                        {row.status === 'Closed' || row.status === 'Rejected' ? 'View Trail' : 'Track Status'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
