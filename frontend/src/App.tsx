import { useState } from 'react'
import type { FormEvent } from 'react'
import './index.css'

type View = 'submit' | 'queue'
type QueueStatus = 'Pending' | 'Approved' | 'Rejected'

type QueueItem = {
  id: string
  requestId: string
  title: string
  requester: string
  submitted: string
  category: string
  status: QueueStatus
  decisionId: string
  stepId: string
}

const initialQueue: QueueItem[] = [
  { id: 'step-1', requestId: 'REQ-0001', title: 'New laptop request', requester: 'Jordan Lee', submitted: 'Today, 09:42', category: 'IT / Equipment', status: 'Pending', decisionId: 'decision-1', stepId: 'step-1' },
  { id: 'step-2', requestId: 'REQ-0002', title: 'Annual leave request', requester: 'Maya Patel', submitted: 'Yesterday, 16:18', category: 'HR / Leave', status: 'Pending', decisionId: 'demo-decision-2', stepId: 'demo-step-2' },
]

function App() {
  const [view, setView] = useState<View>('submit')
  const [queue, setQueue] = useState(initialQueue)
  const [selectedType, setSelectedType] = useState('new-laptop')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actingOn, setActingOn] = useState<string | null>(null)

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')
    window.setTimeout(() => {
      setSubmitting(false)
      setNotice('Request REQ-0003 created with status Submitted.')
      setDescription('')
      setDepartment('')
    }, 500)
  }

  const decide = async (item: QueueItem, decision: 'approve' | 'reject', reason?: string) => {
    setActingOn(item.id)
    setNotice('')
    if (item.decisionId === 'decision-1') {
      try {
        const response = await fetch(`http://localhost:3000/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId: 'manager-1', decision, ...(reason ? { reason } : {}) }),
        })
        if (!response.ok) throw new Error('The backend rejected this decision.')
      } catch {
        setNotice('Could not reach the backend. Start the NestJS server and try again.')
        setActingOn(null)
        return
      }
    }
    setQueue((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: decision === 'approve' ? 'Approved' : 'Rejected' } : candidate))
    setRejecting(null)
    setRejectionReason('')
    setActingOn(null)
    setNotice(`${item.requestId} marked ${decision === 'approve' ? 'Approved' : 'Rejected'}.`)
  }

  const pendingCount = queue.filter((item) => item.status === 'Pending').length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">+</div><div><strong>Operations Hub</strong><span>Internal service orchestration</span></div></div>
        <div className="topbar-meta"><span className="environment"><i /> DEMO ENVIRONMENT</span><span className="avatar" aria-label="Signed in as Alex Morgan">AM</span></div>
      </header>
      <main className="workspace">
        <div className="page-heading"><div><p className="eyebrow">OPERATIONS CONSOLE / 01</p><h1>Service request control</h1><p className="heading-copy">Submit a request or resolve the next item in your approval queue.</p></div><div className="system-health"><i /> All systems nominal</div></div>
        <nav className="view-switcher" aria-label="Primary views">
          <button className={view === 'submit' ? 'active' : ''} onClick={() => setView('submit')} type="button"><span className="nav-index">01</span> Submit request</button>
          <button className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')} type="button"><span className="nav-index">02</span> Routing queue {pendingCount > 0 && <span className="count-badge">{pendingCount}</span>}</button>
        </nav>
        {notice && <div className="notice" role="status"><span>i</span>{notice}</div>}
        {view === 'submit' ? <section className="content-grid" aria-labelledby="submit-title">
          <div className="section-intro"><p className="eyebrow">REQUEST INTAKE</p><h2 id="submit-title">What do you need help with?</h2><p>Choose a service, provide the essential details, and we will route it to the right team.</p><div className="process-note"><span className="note-number">01</span><div><strong>Every request is traceable</strong><br /><span>Your submission gets a unique ID and an immutable status history.</span></div></div></div>
          <form className="panel request-form" onSubmit={submitRequest}><div className="panel-header"><div><p className="eyebrow">NEW REQUEST</p><h3>Request details</h3></div><span className="required-label">* Required fields</span></div>
            <label>Request type <span>*</span><select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}><option value="new-laptop">New laptop / equipment</option><option value="pto-request">PTO / annual leave</option><option value="desk-relocation">Desk relocation</option></select></label>
            <label>Department <span>*</span><select required value={department} onChange={(event) => setDepartment(event.target.value)}><option value="" disabled>Select your department</option><option>Engineering</option><option>People & Culture</option><option>Operations</option></select></label>
            <label>Description <span>*</span><textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you need and why..." rows={5} /><small>{description.length}/500 characters</small></label>
            <label className="file-drop"><span className="upload-icon">↑</span><span><strong>Attach supporting files</strong><br /><small>Optional · PDF, PNG or DOCX · 10 MB max</small></span><input type="file" accept=".pdf,.png,.docx" /><span className="browse">Browse</span></label>
            <div className="form-footer"><span className="secure-note">⌁ Stored securely</span><button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Submitting...' : 'Submit request'} <span>→</span></button></div>
          </form>
        </section> : <section className="queue-section" aria-labelledby="queue-title">
          <div className="queue-toolbar"><div><p className="eyebrow">APPROVAL WORKSPACE / MANAGER-1</p><h2 id="queue-title">Routing queue</h2></div><button className="refresh-button" type="button" onClick={() => setNotice('Queue refreshed just now.')}>↻ Refresh queue</button></div>
          <div className="queue-summary"><div><span className="summary-value">{pendingCount}</span><span>Awaiting your decision</span></div><div><span className="summary-value">{queue.filter((item) => item.status === 'Approved').length}</span><span>Approved this session</span></div><div><span className="summary-value">4h</span><span>Oldest pending item</span></div></div>
          <div className="queue-list">{queue.map((item) => <article className={`queue-card ${item.status.toLowerCase()}`} key={item.id}><div className="queue-card-main"><div className="request-icon">{item.category.startsWith('IT') ? 'IT' : 'HR'}</div><div className="request-content"><div className="request-title-row"><h3>{item.title}</h3><StatusBadge status={item.status} /></div><p>{item.category} <span>·</span> {item.requestId}</p><p className="request-meta">Submitted by <strong>{item.requester}</strong> <span>·</span> {item.submitted}</p></div></div>{item.status === 'Pending' ? <div className="queue-actions">{rejecting === item.id ? <div className="reject-editor"><input autoFocus value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Reason for rejection" /><button className="destructive-button" disabled={!rejectionReason.trim() || actingOn === item.id} onClick={() => decide(item, 'reject', rejectionReason)} type="button">Confirm</button><button className="icon-button" onClick={() => setRejecting(null)} type="button" aria-label="Cancel rejection">×</button></div> : <><button className="outline-button" onClick={() => setRejecting(item.id)} type="button">Reject</button><button className="primary-button compact" disabled={actingOn === item.id} onClick={() => decide(item, 'approve')} type="button">Approve <span>→</span></button></>}</div> : <span className="completed-label">Decision recorded</span>}</article>)}</div>
        </section>}
      </main>
      <footer className="app-footer"><span>Operations Hub <b>·</b> Intake + Routing</span><span className="mono">BUILD 0.1.0 / LOCAL</span></footer>
    </div>
  )
}

function StatusBadge({ status }: { status: QueueStatus }) { return <span className={`status-badge ${status.toLowerCase()}`}><i />{status}</span> }
export default App
