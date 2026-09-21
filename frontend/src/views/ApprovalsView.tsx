import type { RoutingQueueItem } from '../types'

type Props = {
  approvalCards: RoutingQueueItem[]
  handleBulkApproveAll: () => void
  handleRejectOpen: (ticket: string) => void
  handleApprove: (item: RoutingQueueItem) => void
  loading: boolean
}

export default function ApprovalsView({ approvalCards, handleBulkApproveAll, handleRejectOpen, handleApprove, loading }: Props) {
  return (
    <>
      <div className="approval-banner">
        <div className="approval-banner-left">
          <span className="material-symbols-outlined">pending_actions</span>
          <div>
            <strong>{approvalCards.length} approval decisions need your attention</strong>
            <span>Live pending decisions from the routing service.</span>
          </div>
        </div>
        <button type="button" className="primary-action" onClick={handleBulkApproveAll} disabled={loading || approvalCards.length === 0}>
          Batch Approve ({approvalCards.length})
        </button>
      </div>

      <div className="approval-grid">
        {loading ? (
          <div className="empty-state">Loading approvals from the routing service...</div>
        ) : approvalCards.length > 0 ? (
          approvalCards.map((card) => (
            <div key={card.id} className="approval-card" id={card.id}>
              <div className="approval-card-head">
                <div>
                  <span className="eyebrow-label">{card.requestId}</span>
                  <h3>{card.title}</h3>
                </div>
                <span className="priority-badge medium">Pending</span>
              </div>

              <div className="approval-meta">
                <div><span>Requester</span><strong>{card.requester}</strong></div>
                <div><span>Submitted</span><strong>{card.submitted}</strong></div>
              </div>

              <p>{card.category} · Awaiting decision</p>

              <div className="approval-actions">
                <button type="button" className="secondary-action small" onClick={() => handleRejectOpen(card.requestId)}>
                  Reject
                </button>
                <button type="button" className="primary-action small" onClick={() => handleApprove(card)}>Approve</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">All approval items have been cleared.</div>
        )}
      </div>
    </>
  )
}
