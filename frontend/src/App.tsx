import './App.css'
import { tabs } from './data'
import type { CommentMode, RoutingQueueItem, TabKey } from './types'
import CatalogView from './views/CatalogView'
import MyRequestsView from './views/MyRequestsView'
import TeamQueueView from './views/TeamQueueView'
import ApprovalsView from './views/ApprovalsView'
import ReportsView from './views/ReportsView'
import ConfigView from './views/ConfigView'
import RequestCreator from './components/RequestCreator'
import { listRequestTypes } from './api/intakeApi'
import type { RequestType } from './api/intakeApi'
import { decideApproval, listApprovalQueue } from './api/routingApi'
import { useEffect, useState } from 'react'
import './index.css'

type User = {
  id: string
  initials: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
const users: User[] = [
  { id: 'employee-1', initials: 'E1' },
  { id: 'employee-2', initials: 'E2' },
  { id: 'manager-1', initials: 'M1' },
  { id: 'manager-2', initials: 'M2' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('catalog')
  const [searchTerm, setSearchTerm] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [commentMode, setCommentMode] = useState<CommentMode>('reply')
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTicket, setRejectTicket] = useState('REQ-2046')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectQueueItem, setRejectQueueItem] = useState<RoutingQueueItem | null>(null)
  const [intakeFormOpen, setIntakeFormOpen] = useState(false)
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([])

  const showToast = (message: string) => {
    setToastMessage(message)
    window.clearTimeout((window as typeof window & { __opsToast?: number }).__opsToast)
    ;(window as typeof window & { __opsToast?: number }).__opsToast = window.setTimeout(() => {
      setToastMessage('')
    }, 2800)
  }
  
  const [queue, setQueue] = useState<RoutingQueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState(users[0])

  useEffect(() => {
      listRequestTypes(apiBaseUrl)
      .then(setRequestTypes)
      .catch(() => setNotice('Could not load request type configuration.'))
  }, [])

  useEffect(() => {
    if (activeTab !== 'teamqueue' && activeTab !== 'approvals') return

    listApprovalQueue(apiBaseUrl, currentUser.id)
      .then((items) => setQueue(items.map((item) => ({
        id: item.stepId,
        requestId: item.requestId,
        title: item.requestTypeId === 'new-laptop' ? 'New laptop request' : item.requestTypeId,
        requester: item.requesterId,
        submitted: new Date(item.submittedAt).toLocaleString(),
        category: item.requestTypeId === 'new-laptop' ? 'IT / Equipment' : 'Service request',
        status: item.status,
        decisionId: item.decisionId,
        stepId: item.stepId,
      }))))
      .catch(() => {
        setQueue([])
        setNotice('Could not load routing data. Start the NestJS server and try again.')
      })
      .finally(() => setQueueLoading(false))
  }, [activeTab, currentUser.id])

  const decide = async (item: RoutingQueueItem, decision: 'approve' | 'reject', reason?: string) => {
    setActingOn(item.id)
    setNotice('')
    try {
        await decideApproval(apiBaseUrl, item.decisionId, item.stepId, currentUser.id, decision, reason)
    } catch {
      setNotice('Could not reach the backend. Start the NestJS server and try again.')
      setActingOn(null)
      return
    }
    setQueue((current) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, status: decision === 'approve' ? 'Approved' : 'Rejected' }
      : candidate))
    setActingOn(null)
    setRejectModalOpen(false)
    setRejectReason('')
    showToast(`${item.requestId} marked ${decision === 'approve' ? 'approved' : 'rejected'}.`)
  }

  const handleBulkApproveAll = async () => {
    for (const item of queue) {
      await decide(item, 'approve')
    }
  }
  const handleTabChange = (tab: TabKey) => {
    if (tab === 'teamqueue' || tab === 'approvals') {
      setQueueLoading(true)
      setNotice('')
    }
    setActiveTab(tab)
  }
  const handleRejectOpen = (ticket: string) => {
    setRejectTicket(ticket)
    setRejectReason('')
    setRejectQueueItem(queue.find((item) => item.requestId === ticket) ?? null)
    setRejectModalOpen(true)
  }
  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason.')
      return
    }
    if (rejectQueueItem) {
      void decide(rejectQueueItem, 'reject', rejectReason)
      setRejectQueueItem(null)
      return
    }
    setRejectModalOpen(false)
    setRejectReason('')
    showToast(`Ticket ${rejectTicket} rejected with formal rationale dispatched.`)
  }

  return (
    <div className="ops-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div
            className="brand-pill"
            onClick={() => setActiveTab('catalog')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                setActiveTab('catalog')
              }
            }}
          >
            <div className="brand-mark">OH</div>
            <span className="brand-name">OpsHub</span>
          </div>

          <div className="header-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Search requests, tickets, KB..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <nav className="main-tabs" aria-label="Primary navigation">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.key === 'myrequests' && <span className="tab-count">4</span>}
                {tab.key === 'teamqueue' && <span className="tab-count alert">3</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-right">
          <button type="button" className="icon-button neutral" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
            <span className="alert-dot">2</span>
          </button>
          <button type="button" className="icon-button neutral hidden-mobile" aria-label="Help">
            <span className="material-symbols-outlined">help</span>
          </button>
          <label className="acting-user-picker">
            <span>Acting as</span>
            <select value={currentUser.id} onChange={(event) => {
              if (activeTab === 'teamqueue' || activeTab === 'approvals') setQueueLoading(true)
              setCurrentUser(users.find((user) => user.id === event.target.value) ?? users[0])
            }}>
              {users.map((user) => <option key={user.id} value={user.id}>{user.initials} · {user.id}</option>)}
            </select>
          </label>
        </div>
      </header>

      <main className="workspace-shell">
        <div className="workspace-inner">
          <section className={`tab-pane ${activeTab === 'catalog' ? 'visible' : 'hidden'}`}>
            <CatalogView onInitiateRequest={() => {
              setIntakeFormOpen(true)
              setNotice('')
            }} />
            {intakeFormOpen && <RequestCreator
              apiBaseUrl={apiBaseUrl}
              currentUserId={currentUser.id}
              requestTypes={requestTypes}
              onSubmitted={(message) => {
                setNotice(message)
                setActiveTab('myrequests')
                setIntakeFormOpen(false)
              }}
            />}
          </section>

          <section className={`tab-pane ${activeTab === 'myrequests' ? 'visible' : 'hidden'}`}>
            <MyRequestsView />
          </section>

          <section className={`tab-pane ${activeTab === 'teamqueue' ? 'visible' : 'hidden'}`}>
            <TeamQueueView commentMode={commentMode} setCommentMode={setCommentMode} showToast={showToast} queue={queue} />
            <div className="table-panel" style={{ marginTop: 24 }}>
              <div className="table-header">
                <h3>Live routing queue</h3>
                <span>{queue.filter((item) => item.status === 'Pending').length} awaiting decision</span>
              </div>
              {notice && <div className="empty-state" role="status">{notice}</div>}
              {queue.map((item) => (
                <div className="field-row" key={item.id}>
                  <div className="field-copy">
                    <strong>{item.title}</strong>
                    <span>{item.requestId} · {item.category} · {item.requester} · {item.submitted}</span>
                  </div>
                  <span className={`state-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                  {item.status === 'Pending' && <>
                    <button type="button" className="secondary-action small" disabled={actingOn === item.id} onClick={() => handleRejectOpen(item.requestId)}>Reject</button>
                    <button type="button" className="primary-action small" disabled={actingOn === item.id} onClick={() => void decide(item, 'approve')}>Approve</button>
                  </>}
                </div>
              ))}
            </div>
          </section>

          <section className={`tab-pane ${activeTab === 'approvals' ? 'visible' : 'hidden'}`}>
            <ApprovalsView
              approvalCards={queue}
              handleBulkApproveAll={handleBulkApproveAll}
              handleRejectOpen={handleRejectOpen}
              handleApprove={(item) => { void decide(item, 'approve') }}
              loading={queueLoading}
            />
          </section>

          <section className={`tab-pane ${activeTab === 'reports' ? 'visible' : 'hidden'}`}>
            <ReportsView showToast={showToast} />
          </section>

          <section className={`tab-pane ${activeTab === 'config' ? 'visible' : 'hidden'}`}>
            <ConfigView showToast={showToast} />
          </section>
        </div>
      </main>

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {rejectModalOpen && (
        <div className="modal-backdrop" onClick={() => { setRejectModalOpen(false); setRejectQueueItem(null) }}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-heading">
                <span className="material-symbols-outlined">error</span>
                <strong>Reject ticket {rejectTicket}</strong>
              </div>
              <button type="button" className="icon-button neutral" onClick={() => setRejectModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <label className="field-label modal-field">
              <span>Mandatory Rejection Explanation *</span>
              <small>This feedback is dispatched directly into the requester's notification thread.</small>
              <textarea rows={5} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Explain the reason for rejection..." />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-action small" onClick={() => setRejectModalOpen(false)}>Cancel</button>
              <button type="button" className="primary-action small" onClick={handleRejectConfirm}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
