import type { ApprovalItem } from '../types'

type Props = {
  approvalCards: ApprovalItem[]
  handleBulkApproveAll: () => void
  handleRejectOpen: (ticket: string) => void
  showToast: (message: string) => void
}

export default function ApprovalsView({ approvalCards, handleBulkApproveAll, handleRejectOpen, showToast }: Props) {
  return (
    <>
      <div className="approval-banner">
        <div className="approval-banner-left">
          <span className="material-symbols-outlined">pending_actions</span>
          <div>
            <strong>3 approval decisions need your attention</strong>
            <span>These items are waiting for a final sign-off before dispatch.</span>
          </div>
        </div>
        <button type="button" className="primary-action" onClick={handleBulkApproveAll}>
          Batch Review (3)
        </button>
      </div>

      <div className="approval-grid">
        {approvalCards.length > 0 ? (
          approvalCards.map((card) => (
            <div key={card.id} className="approval-card" id={card.id}>
              <div className="approval-card-head">
                <div>
                  <span className="eyebrow-label">{card.ticket}</span>
                  <h3>{card.title}</h3>
                </div>
                <span className={`priority-badge ${card.priority.toLowerCase()}`}>{card.priority}</span>
              </div>

              <div className="approval-meta">
                <div><span>Requester</span><strong>{card.requester}</strong></div>
                <div><span>Value</span><strong>{card.amount}</strong></div>
              </div>

              <p>{card.detail}</p>

              <div className="approval-actions">
                <button type="button" className="secondary-action small" onClick={() => handleRejectOpen(card.ticket)}>
                  Reject
                </button>
                <button type="button" className="primary-action small" onClick={() => showToast('Approval registered. Dispatched to next gate.')}>Approve</button>
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
