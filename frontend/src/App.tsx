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
  }

  const handleSubmitRequest = () => {
    showToast('Request submitted! Tracking ID: #OPS-' + Math.floor(1000 + Math.random() * 9000))
    setActiveTab('myrequests')
  }

  const handleFilterChange = (filter: CatalogFilter) => {
    setActiveFilter(filter)
    showToast(`Filtered catalog by: ${filter.toUpperCase()}`)
  }

  const handleBulkApproveAll = () => {
    setApprovalCards([])
    showToast('All 3 pending approvals cleared!')
  }

  const handleRejectOpen = (ticket: string) => {
    setRejectTicket(ticket)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason.')
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
