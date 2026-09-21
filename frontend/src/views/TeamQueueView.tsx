import type { CommentMode, RoutingQueueItem } from '../types'

type Props = {
  commentMode: CommentMode
  setCommentMode: (mode: CommentMode) => void
  showToast: (message: string) => void
  queue: RoutingQueueItem[]
}

export default function TeamQueueView({ commentMode, setCommentMode, showToast, queue }: Props) {
  return (
    <>
      <div className="queue-toolbar-row">
        <div className="toolbar-group">
          <button type="button" className="filter-button selected">All queues</button>
          <button type="button" className="filter-button">High priority</button>
          <button type="button" className="filter-button">Escalated</button>
        </div>
        <div className="toolbar-right">
          <span>Live backend data</span>
          <button type="button" className="secondary-action small" onClick={() => showToast('Manual refresh complete')}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div className="queue-layout">
        <div className="queue-panel">
          <div className="table-header">
            <h3>Operational Queue</h3>
            <span>{queue.length} pending items</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Requester</th>
                <th>Queue</th>
                <th>Submitted</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((row) => (
                <tr key={row.id} className="queue-row" onClick={() => showToast(`Opened ${row.requestId}`)}>
                  <td><strong>{row.title}</strong><span className="ticket-id">{row.requestId}</span></td>
                  <td>{row.requester}</td>
                  <td>{row.category}</td>
                  <td>{row.submitted}</td>
                  <td><span className="risk-badge medium">Pending</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="eyebrow-label">REQUEST DETAIL</div>
              <h3>{queue[0]?.requestId ?? 'No selection'}</h3>
            </div>
            <button type="button" className="secondary-action small" onClick={() => showToast('Ticket flagged for follow-up')}>
              <span className="material-symbols-outlined">flag</span>
            </button>
          </div>

          <div className="requester-block">
            <div className="avatar small">NC</div>
            <div>
              <strong>{queue[0]?.requester ?? 'No pending requester'}</strong>
                <span>{queue[0]?.category ?? 'Live routing queue'}</span>
            </div>
            <span className="mini-badge warning">Priority</span>
          </div>

          <div className="detail-copy">
            <div><span>Request type</span><strong>{queue[0]?.title ?? 'No pending request'}</strong></div>
            <div><span>Assigned queue</span><strong>{queue[0]?.category ?? 'Not assigned'}</strong></div>
            <div><span>Submitted</span><strong>{queue[0]?.submitted ?? 'No pending request'}</strong></div>
          </div>

          <div className="comment-panel">
            <div className="comment-switcher">
              <button type="button" className={commentMode === 'internal' ? 'active' : ''} onClick={() => setCommentMode('internal')}>Internal</button>
              <button type="button" className={commentMode === 'reply' ? 'active' : ''} onClick={() => setCommentMode('reply')}>Reply</button>
            </div>
            <span className="comment-hint">{commentMode === 'internal' ? 'Only visible to Agents' : 'Customer will receive email notification'}</span>
            <textarea placeholder={commentMode === 'internal' ? 'Add confidential internal fulfillment note...' : 'Reply to Alex Morgan...'} rows={4} />
            <button type="button" className="primary-action small" onClick={() => showToast('Comment appended to ticket audit trail')}>
              <span className="material-symbols-outlined">send</span>
              <span>Post update</span>
            </button>
          </div>

          {queue.length === 0 && <div className="empty-state">No pending routing decisions for this approver.</div>}
        </aside>
      </div>
    </>
  )
}
