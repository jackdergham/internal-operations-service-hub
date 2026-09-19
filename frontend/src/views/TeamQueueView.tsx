import { teamQueueRows } from '../data'
import type { CommentMode } from '../types'

type Props = {
  commentMode: CommentMode
  setCommentMode: (mode: CommentMode) => void
  showToast: (message: string) => void
}

export default function TeamQueueView({ commentMode, setCommentMode, showToast }: Props) {
  return (
    <>
      <div className="queue-toolbar-row">
        <div className="toolbar-group">
          <button type="button" className="filter-button selected">All queues</button>
          <button type="button" className="filter-button">High priority</button>
          <button type="button" className="filter-button">Escalated</button>
        </div>
        <div className="toolbar-right">
          <span>Auto-Refresh in 12s</span>
          <button type="button" className="secondary-action small" onClick={() => showToast('Manual refresh complete')}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div className="queue-layout">
        <div className="queue-panel">
          <div className="table-header">
            <h3>Operational Queue</h3>
            <span>4 active items</span>
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
              {teamQueueRows.map((row) => (
                <tr key={row.id} className="queue-row" onClick={() => showToast(`Opened ${row.id}`)}>
                  <td><strong>{row.title}</strong><span className="ticket-id">{row.id}</span></td>
                  <td>{row.requester}</td>
                  <td>{row.queue}</td>
                  <td>{row.submitted}</td>
                  <td><span className={`risk-badge ${row.risk.toLowerCase()}`}>{row.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="eyebrow-label">REQUEST DETAIL</div>
              <h3>REQ-1842</h3>
            </div>
            <button type="button" className="secondary-action small" onClick={() => showToast('Ticket flagged for follow-up')}>
              <span className="material-symbols-outlined">flag</span>
            </button>
          </div>

          <div className="requester-block">
            <div className="avatar small">NC</div>
            <div>
              <strong>Nora Chen</strong>
              <span>Platform Engineer</span>
            </div>
            <span className="mini-badge warning">Priority</span>
          </div>

          <div className="detail-copy">
            <div><span>Request type</span><strong>Cloud Access Review</strong></div>
            <div><span>Assigned queue</span><strong>Security / IAM</strong></div>
            <div><span>Requested ETA</span><strong>Today, 15:00</strong></div>
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

          <div className="timeline-block">
            <div className="timeline-item"><span className="timeline-dot" /><div><strong>Review assigned</strong><small>09:10 AM</small></div></div>
            <div className="timeline-item"><span className="timeline-dot" /><div><strong>Security check pending</strong><small>09:25 AM</small></div></div>
            <div className="timeline-item"><span className="timeline-dot" /><div><strong>Awaiting sponsor approval</strong><small>09:41 AM</small></div></div>
          </div>
        </aside>
      </div>
    </>
  )
}
