import { useMemo, useState } from 'react'
import './App.css'
import { tabs, catalogCards, initialApprovals } from './data'
import type { ApprovalItem, CatalogFilter, CommentMode, TabKey } from './types'
import CatalogView from './views/CatalogView'
import MyRequestsView from './views/MyRequestsView'
import TeamQueueView from './views/TeamQueueView'
import ApprovalsView from './views/ApprovalsView'
import ReportsView from './views/ReportsView'
import ConfigView from './views/ConfigView'
import { useEffect, useState } from 'react'
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

type QueueResponse = {
  decisionId: string
  stepId: string
  requestId: string
  requesterId: string
  requestTypeId: string
  status: QueueStatus
  submittedAt: string
}

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

const initialQueue: QueueItem[] = [
  { id: 'step-1', requestId: 'REQ-0001', title: 'New laptop request', requester: 'Jordan Lee', submitted: 'Today, 09:42', category: 'IT / Equipment', status: 'Pending', decisionId: 'decision-1', stepId: 'step-1' },
  { id: 'step-2', requestId: 'REQ-0002', title: 'Annual leave request', requester: 'Maya Patel', submitted: 'Yesterday, 16:18', category: 'HR / Leave', status: 'Pending', decisionId: 'demo-decision-2', stepId: 'demo-step-2' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('catalog')
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [commentMode, setCommentMode] = useState<CommentMode>('reply')
  const [approvalCards, setApprovalCards] = useState<ApprovalItem[]>(initialApprovals)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTicket, setRejectTicket] = useState('REQ-2046')
  const [rejectReason, setRejectReason] = useState('')

  const visibleCatalog = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase()
    return catalogCards.filter((card) => {
      const matchesFilter = activeFilter === 'all' || card.category === activeFilter
      const matchesSearch =
        lowerSearch.length === 0 ||
        `${card.name} ${card.description} ${card.badge}`.toLowerCase().includes(lowerSearch)
      return matchesFilter && matchesSearch
    })
  }, [activeFilter, searchTerm])

  const showToast = (message: string) => {
    setToastMessage(message)
    window.clearTimeout((window as typeof window & { __opsToast?: number }).__opsToast)
    ;(window as typeof window & { __opsToast?: number }).__opsToast = window.setTimeout(() => {
      setToastMessage('')
    }, 2800)
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
  const [currentUser, setCurrentUser] = useState(users[0])
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    if (view !== 'queue') return

    fetch(`${apiBaseUrl}/routing-decisions/queue?approverId=${currentUser.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Queue request failed')
        return response.json() as Promise<QueueResponse[]>
      })
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
      .catch(() => setNotice('Could not load the routing queue. Start the NestJS server and try again.'))
  }, [currentUser.id, view])

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')

    try {
      const response = await fetch(`${apiBaseUrl}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': currentUser.id,
        },
        body: JSON.stringify({
          requesterId: currentUser.id,
          requestTypeId: selectedType,
          description,
          formData: { department },
          idempotencyKey: crypto.randomUUID(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message ?? 'The request could not be submitted.')
      }

      setSubmitting(false)
      setNotice(`Request ${payload.request.id} created with status ${payload.request.status}.`)
      setDescription('')
      setDepartment('')
    } catch (error) {
      setSubmitting(false)
      setNotice(error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'Could not reach the Intake API. Start the NestJS server and try again.')
    }
  }

  const decide = async (item: QueueItem, decision: 'approve' | 'reject', reason?: string) => {
    setActingOn(item.id)
    setNotice('')
    try {
        const response = await fetch(`${apiBaseUrl}/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId: currentUser.id, decision, ...(reason ? { reason } : {}) }),
        })
        if (!response.ok) throw new Error('The backend rejected this decision.')
    } catch {
      setNotice('Could not reach the backend. Start the NestJS server and try again.')
      setActingOn(null)
      return
    }
    setRejectModalOpen(false)
    setRejectReason('')
    showToast('Ticket rejected with formal rationale dispatched.')
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
                onClick={() => setActiveTab(tab.key)}
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
          <div className="profile-pill">
            <div className="profile-copy">
              <span className="profile-name">Alex Morgan</span>
              <span className="profile-role">SecOps Lead</span>
            </div>
            <div className="avatar">AM</div>
          </div>
        </div>
      </header>

      <main className="workspace-shell">
        <div className="workspace-inner">
          <section className={`tab-pane ${activeTab === 'catalog' ? 'visible' : 'hidden'}`}>
            <CatalogView
              activeFilter={activeFilter}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              handleSubmitRequest={handleSubmitRequest}
              handleFilterChange={handleFilterChange}
              showToast={showToast}
              visibleCatalog={visibleCatalog}
            />
          </section>

          <section className={`tab-pane ${activeTab === 'myrequests' ? 'visible' : 'hidden'}`}>
            <MyRequestsView />
          </section>

          <section className={`tab-pane ${activeTab === 'teamqueue' ? 'visible' : 'hidden'}`}>
            <TeamQueueView commentMode={commentMode} setCommentMode={setCommentMode} showToast={showToast} />
          </section>

          <section className={`tab-pane ${activeTab === 'approvals' ? 'visible' : 'hidden'}`}>
            <ApprovalsView
              approvalCards={approvalCards}
              handleBulkApproveAll={handleBulkApproveAll}
              handleRejectOpen={handleRejectOpen}
              showToast={showToast}
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
        <div className="modal-backdrop" onClick={() => setRejectModalOpen(false)}>
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
