import type { RequestSummary } from '../api/intakeApi'
import { useEffect, useState } from 'react'
import { isSearching, matchesSearch } from '../search'
import { fetchRequestAudit } from '../api/auditApi'
import type { RequestAudit } from '../api/auditApi'

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
  searchTerm: string
  loading: boolean
  apiBaseUrl: string
  actorId: string
}

export default function MyRequestsView({ requests, searchTerm, loading, apiBaseUrl, actorId }: Props) {
  const [trackedRequestId, setTrackedRequestId] = useState<string | null>(null)
  const [audit, setAudit] = useState<RequestAudit | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  const searching = isSearching(searchTerm)
  const visible = requests.filter((request) =>
    matchesSearch(searchTerm, [request.id, request.requestTypeName, request.department, request.description, request.status]))
  const tracked = visible.find((request) => request.id === trackedRequestId) ?? visible[0] ?? null
  const trackedId = tracked?.id ?? null

  useEffect(() => {
    if (!trackedId) {
      setAudit(null)
      setAuditLoading(false)
      return
    }
    let cancelled = false
    setAuditLoading(true)
    fetchRequestAudit(apiBaseUrl, actorId, trackedId)
      .then((result) => {
        if (!cancelled) setAudit(result)
      })
      .catch(() => {
        if (!cancelled) setAudit(null)
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trackedId, apiBaseUrl, actorId])

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

  if (visible.length === 0 || !tracked) {
    return (
      <div className="table-panel">
        <div className="table-header">
          <h3>Submissions History &amp; Status</h3>
          <span>0 of {requests.length} Records Found</span>
        </div>
        <div className="request-table-scroll">
          <p style={{ padding: '1.5rem' }}>No requests match “{searchTerm.trim()}”.</p>
        </div>
      </div>
    )
  }

  const rejected = tracked.status === 'Rejected'
  const currentStageIndex = rejected
    ? STAGES.indexOf('Pending Approval')
    : (STAGES as readonly string[]).indexOf(tracked.status)
  const rejectedStep = audit?.routingDecision?.approvalSteps.find((step) => step.status === 'Rejected')
  const visibleComments = audit?.comments ?? []

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
                <div className={`step-bullet ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''} ${isActive && !rejected && ['Pending Approval', 'In Progress'].includes(stage) ? 'loading' : ''}`}>
                  <span className="material-symbols-outlined">{isComplete ? 'check' : STAGE_ICONS[stage]}</span>
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

        {auditLoading && <p className="audit-loading">Loading trail details…</p>}

        {!auditLoading && rejected && (
          <div className="audit-note audit-note-rejected">
            <strong>Why this was rejected</strong>
            <p>{rejectedStep?.rejectionReason ?? 'No reason was recorded for this rejection.'}</p>
            {rejectedStep?.decidedBy && <span className="audit-note-meta">Decided by {rejectedStep.decidedBy}</span>}
          </div>
        )}

        {!auditLoading && visibleComments.length > 0 && (
          <div className="audit-note audit-comments">
            <strong>Comments on this request</strong>
            <ul>
              {visibleComments.map((comment) => (
                <li key={comment.id}>
                  <span className="audit-comment-meta">{comment.authorId} · {formatDate(comment.createdAt)}</span>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="table-panel">
        <div className="table-header">
          <h3>Submissions History &amp; Status</h3>
          <span>
            {searching
              ? `${visible.length} of ${requests.length} Records Found`
              : `${requests.length} Record${requests.length === 1 ? '' : 's'} Found`}
          </span>
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
              {visible.map((row) => {
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
                      <button
                        type="button"
                        className="request-action"
                        onClick={() => setTrackedRequestId(row.id)}
                        aria-label={`${row.status === 'Closed' || row.status === 'Rejected' ? 'View trail for' : 'Track status for'} request ${row.id}`}
                      >
                        {row.status === 'Closed' || row.status === 'Rejected' ? 'View Trail' : 'Track Status'}
                      </button>
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
