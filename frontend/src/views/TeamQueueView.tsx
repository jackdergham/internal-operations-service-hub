import { useEffect, useState } from 'react'
import type { CommentMode } from '../types'
import type { FulfillmentComment, FulfillmentQueueItem } from '../api/fulfillmentApi'
import { listFulfillmentComments } from '../api/fulfillmentApi'
import { isSearching, matchesSearch } from '../search'

type Props = {
  commentMode: CommentMode
  setCommentMode: (mode: CommentMode) => void
  showToast: (message: string) => void
  apiBaseUrl: string
  currentUserId: string
  notice: string
  loading: boolean
  queue: FulfillmentQueueItem[]
  searchTerm: string
  onRefresh: () => void
  onAssign: (requestId: string) => void
  onResolve: (requestId: string) => void
  onClose: (requestId: string) => void
  onComment: (requestId: string, body: string, visibility: FulfillmentComment['visibility']) => void
}

export default function TeamQueueView({
  apiBaseUrl,
  currentUserId,
  commentMode,
  setCommentMode,
  showToast,
  notice,
  loading,
  queue,
  searchTerm,
  onRefresh,
  onAssign,
  onResolve,
  onClose,
  onComment,
}: Props) {
  const [selectedRequestId, setSelectedRequestId] = useState(queue[0]?.requestId ?? '')
  const [comments, setComments] = useState<FulfillmentComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const searching = isSearching(searchTerm)
  const visibleQueue = queue.filter((item) => matchesSearch(searchTerm, [
    item.requestId,
    item.requestTypeId,
    item.requesterId,
    item.queue,
    item.status,
    item.description,
    item.assignedFulfillerId,
  ]))
  // The detail panel always shows a ticket that is in the visible list; if the
  // search hides the chosen one it falls back to the first match (the choice
  // itself is kept, so clearing the search brings it back).
  const selected = visibleQueue.find((item) => item.requestId === selectedRequestId) ?? visibleQueue[0]
  const selectedRequestIdForComments = selected?.requestId ?? ''
  // Only show comments that belong to the ticket in the detail panel. Searching can
  // leave nothing selected, and switching tickets must not show the previous one's.
  const selectedComments = comments.filter((comment) => comment.requestId === selectedRequestIdForComments)

  useEffect(() => {
    if (!selectedRequestIdForComments || !currentUserId) return
    listFulfillmentComments(apiBaseUrl, currentUserId, selectedRequestIdForComments)
      .then(setComments)
      .catch(() => setComments([]))
  }, [apiBaseUrl, currentUserId, selectedRequestIdForComments])

  const postComment = () => {
    if (!selected || !commentBody.trim()) return
    onComment(selected.requestId, commentBody.trim(), commentMode === 'internal' ? 'internal' : 'requester-visible')
    setCommentBody('')
  }

  return (
    <>
      <div className="queue-toolbar-row">
        <div className="toolbar-group">
          <button type="button" className="filter-button selected">All queues</button>
        </div>
        <div className="toolbar-right">
          <span>{loading ? 'Loading fulfillment data...' : 'Live fulfillment data'}</span>
          <button type="button" className="secondary-action small" onClick={onRefresh} aria-label="Refresh fulfillment queue">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div className="queue-layout">
        <div className="queue-panel">
          <div className="table-header">
            <h3>Operational Queue</h3>
            <span>{searching ? `${visibleQueue.length} of ${queue.length} items` : `${queue.length} open items`}</span>
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
              {visibleQueue.map((row) => (
                <tr key={row.requestId} className="queue-row" onClick={() => setSelectedRequestId(row.requestId)}>
                  <td><strong>{row.requestTypeId}</strong><span className="ticket-id">{row.requestId}</span></td>
                  <td>{row.requesterId}</td>
                  <td>{row.queue}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td><span className="risk-badge medium">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="eyebrow-label">REQUEST DETAIL</div>
              <h3>{selected?.requestId ?? 'No selection'}</h3>
            </div>
            <button type="button" className="secondary-action small" onClick={() => showToast('Ticket flagged for follow-up')}>
              <span className="material-symbols-outlined">flag</span>
            </button>
          </div>

          <div className="requester-block">
            <div className="avatar small">NC</div>
            <div>
              <strong>{selected?.requesterId ?? 'No pending requester'}</strong>
                <span>{selected?.queue ?? 'Live fulfillment queue'}</span>
            </div>
            <span className="mini-badge warning">Priority</span>
          </div>

          <div className="detail-copy">
            <div><span>Request type</span><strong>{selected?.requestTypeId ?? 'No pending request'}</strong></div>
            <div><span>Assigned queue</span><strong>{selected?.queue ?? 'Not assigned'}</strong></div>
            <div><span>Status</span><strong>{selected?.status ?? 'No pending request'}</strong></div>
            <div><span>Fulfiller</span><strong>{selected?.assignedFulfillerId ?? 'Unassigned'}</strong></div>
          </div>

          <div className="comment-panel">
            <strong>Request comments</strong>
            {selectedComments.length === 0 && <span className="comment-hint">No comments yet.</span>}
            {selectedComments.map((comment) => (
              <div key={comment.id} className="field-copy">
                <strong>{comment.authorId}</strong>
                <span>{comment.body} · {new Date(comment.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="comment-panel">
            <div className="comment-switcher">
              <button type="button" className={commentMode === 'internal' ? 'active' : ''} onClick={() => setCommentMode('internal')}>Internal</button>
              <button type="button" className={commentMode === 'reply' ? 'active' : ''} onClick={() => setCommentMode('reply')}>Reply</button>
            </div>
            <span className="comment-hint">{commentMode === 'internal' ? 'Only visible to Agents' : 'Customer will receive email notification'}</span>
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={commentMode === 'internal' ? 'Add confidential internal fulfillment note...' : 'Reply to requester...'} rows={4} />
            <button type="button" className="primary-action small" onClick={postComment} disabled={!selected || !commentBody.trim()}>
              <span className="material-symbols-outlined">send</span>
              <span>Post update</span>
            </button>
          </div>

          <div className="toolbar-group">
            {selected?.assignedFulfillerId !== currentUserId && <button type="button" className="secondary-action small" onClick={() => selected && onAssign(selected.requestId)}>Assign to me</button>}
            {selected?.status === 'In Progress' && <button type="button" className="primary-action small" onClick={() => selected && onResolve(selected.requestId)}>Resolve</button>}
            {selected?.status === 'Resolved' && <button type="button" className="primary-action small" onClick={() => selected && onClose(selected.requestId)}>Close</button>}
          </div>

          {(visibleQueue.length === 0 || notice) && (
            <div className="empty-state" role="status">
              {notice || (searching && queue.length > 0
                ? `No requests match “${searchTerm.trim()}”.`
                : 'No fulfillment items for this queue.')}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
