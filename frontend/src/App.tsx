import './App.css'
import logo from './assets/logo.png'
import { tabs } from './data'
import { isRequestListTab, searchPlaceholder } from './search'
import type { CommentMode, RoutingQueueItem, TabKey } from './types'
import CatalogView from './views/CatalogView'
import MyRequestsView from './views/MyRequestsView'
import TeamQueueView from './views/TeamQueueView'
import ApprovalsView from './views/ApprovalsView'
import ReportsView from './views/ReportsView'
import ConfigView from './views/ConfigView'
import RequestCreator from './components/RequestCreator'
import { listMyRequests, listRequestTypes } from './api/intakeApi'
import type { RequestSummary, RequestType } from './api/intakeApi'
import { decideApproval, listApprovalQueue } from './api/routingApi'
import {
  addFulfillmentComment,
  assignFulfillmentRequest,
  closeFulfillmentRequest,
  listFulfillmentQueue,
  resolveFulfillmentRequest,
} from './api/fulfillmentApi'
import type { FulfillmentQueueItem } from './api/fulfillmentApi'
import { listActors } from './api/directoryApi'
import type { Actor } from './api/directoryApi'
import { listNotifications, markNotificationRead } from './api/notificationsApi'
import type { NotificationItem } from './api/notificationsApi'
import { useEffect, useState } from 'react'
import './index.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function App() {
  const [activeTab, setActiveTabState] = useState<TabKey>('catalog')
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
  const [users, setUsers] = useState<Actor[]>([])
  const [currentUser, setCurrentUser] = useState<Actor | null>(null)
  const [fulfillmentQueue, setFulfillmentQueue] = useState<FulfillmentQueueItem[]>([])
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false)
  const [myRequests, setMyRequests] = useState<RequestSummary[]>([])
  const [myRequestsLoading, setMyRequestsLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const shouldShowApprovals = currentUser?.roles.includes('approver') && !currentUser.roles.includes('fulfiller')

  // A search term belongs to the list it was typed into, so changing tabs starts
  // with a clean search. Otherwise a request submitted from the catalog could land
  // on My Requests already hidden by a leftover filter.
  const setActiveTab = (tab: TabKey) => {
    if (tab === activeTab) return
    setSearchTerm('')
    setActiveTabState(tab)
  }
  const showSearch = isRequestListTab(activeTab)
  const searchLabel = searchPlaceholder(activeTab, Boolean(shouldShowApprovals))

  useEffect(() => {
      listRequestTypes(apiBaseUrl)
      .then(setRequestTypes)
      .catch(() => setNotice('Could not load request type configuration.'))
  }, [])

  useEffect(() => {
    listActors(apiBaseUrl)
      .then((actors) => {
        setUsers(actors)
        setCurrentUser((current) => current ?? actors[0] ?? null)
      })
      .catch(() => setNotice('Could not load the org chart. Start the NestJS server and try again.'))
  }, [])

  useEffect(() => {
    if (!shouldShowApprovals) return
    if (!currentUser) return

    listApprovalQueue(apiBaseUrl, currentUser.employeeId)
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
      .finally(() => {
        if (activeTab === 'teamqueue' || activeTab === 'approvals') setQueueLoading(false)
      })
  }, [activeTab, currentUser, shouldShowApprovals])

  useEffect(() => {
    if (!currentUser || shouldShowApprovals || !currentUser.roles.some((role) => role === 'fulfiller' || role === 'admin')) return
    if (activeTab === 'teamqueue') setFulfillmentLoading(true)
    listFulfillmentQueue(apiBaseUrl, currentUser.employeeId)
      .then(setFulfillmentQueue)
      .catch(() => {
        setFulfillmentQueue([])
        setNotice('Could not load fulfillment data. Start the NestJS server and try again.')
      })
      .finally(() => {
        if (activeTab === 'teamqueue') setFulfillmentLoading(false)
      })
  }, [activeTab, currentUser, shouldShowApprovals])

  useEffect(() => {
    if (activeTab !== 'myrequests' || !currentUser) return
    setMyRequestsLoading(true)
    listMyRequests(apiBaseUrl, currentUser.employeeId)
      .then(setMyRequests)
      .catch(() => {
        setMyRequests([])
        setNotice('Could not load your requests. Start the NestJS server and try again.')
      })
      .finally(() => setMyRequestsLoading(false))
  }, [activeTab, currentUser])

  useEffect(() => {
    if (!currentUser) return
    listNotifications(apiBaseUrl, currentUser.employeeId)
      .then(setNotifications)
      .catch(() => setNotice('Could not load notifications. Start the NestJS server and try again.'))
  }, [currentUser])

  const unreadNotifications = notifications.filter((notification) => !notification.readAt)
  const relevantQueueCount = shouldShowApprovals
    ? queue.length
    : currentUser?.roles.some((role) => role === 'fulfiller' || role === 'admin')
      ? fulfillmentQueue.length
      : 0
  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!currentUser || notification.readAt) return
    try {
      await markNotificationRead(apiBaseUrl, currentUser.employeeId, notification.id)
      setNotifications((current) => current.map((candidate) => candidate.id === notification.id
        ? { ...candidate, readAt: new Date().toISOString() }
        : candidate))
    } catch {
      setNotice('Could not mark the notification as read.')
    }
  }

  const refreshFulfillmentQueue = () => {
    if (!currentUser) return
    setFulfillmentLoading(true)
    listFulfillmentQueue(apiBaseUrl, currentUser.employeeId)
      .then(setFulfillmentQueue)
      .catch(() => setNotice('Could not refresh fulfillment data.'))
      .finally(() => setFulfillmentLoading(false))
  }

  const runFulfillmentAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action()
      refreshFulfillmentQueue()
      showToast(successMessage)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The fulfillment action failed.')
    }
  }

  const decide = async (item: RoutingQueueItem, decision: 'approve' | 'reject', reason?: string) => {
    if (!currentUser) return
    setNotice('')
    try {
        await decideApproval(apiBaseUrl, item.decisionId, item.stepId, currentUser.employeeId, decision, reason)
    } catch {
      setNotice('Could not reach the backend. Start the NestJS server and try again.')
      return
    }
    setQueue((current) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, status: decision === 'approve' ? 'Approved' : 'Rejected' }
      : candidate))
    setRejectModalOpen(false)
    setRejectReason('')
    showToast(`${item.requestId} marked ${decision === 'approve' ? 'approved' : 'rejected'}.`)
  }

  // Acts on the cards it is given (the ones on screen), never on hidden ones.
  const handleBulkApproveAll = async (items: RoutingQueueItem[]) => {
    for (const item of items) {
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
            <img className="brand-logo" src={logo} alt="OpsHub" />
            <span className="brand-name">OpsHub</span>
          </div>

          {showSearch && (
            <div className="header-search">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                placeholder={searchLabel}
                aria-label={searchLabel}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          )}

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
                {tab.key === 'myrequests' && myRequests.length > 0 && (
                  <span className="tab-count">{myRequests.length}</span>
                )}
                {tab.key === 'teamqueue' && relevantQueueCount > 0 && (
                  <span className="tab-count alert">{relevantQueueCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-right">
          <div className="notification-anchor">
            <button
              type="button"
              className="icon-button neutral"
              aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ''}`}
              aria-expanded={notificationsOpen}
              onClick={() => {
                const opening = !notificationsOpen
                setNotificationsOpen(opening)
                if (opening && currentUser) {
                  listNotifications(apiBaseUrl, currentUser.employeeId)
                    .then(setNotifications)
                    .catch(() => setNotice('Could not refresh notifications.'))
                }
              }}
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadNotifications.length > 0 && <span className="alert-dot">{unreadNotifications.length}</span>}
            </button>
            {notificationsOpen && (
              <div className="notification-panel" role="dialog" aria-label="Notifications">
                <div className="notification-panel-header">
                  <strong>Notifications</strong>
                  <span>{unreadNotifications.length} unread</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="notification-empty">You are all caught up.</p>
                ) : (
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <button
                        type="button"
                        className={`notification-item ${notification.readAt ? '' : 'unread'}`}
                        key={notification.id}
                        onClick={() => void handleNotificationClick(notification)}
                      >
                        <span className="notification-icon material-symbols-outlined">
                          {notification.type.includes('approval') ? 'task_alt' : 'notifications'}
                        </span>
                        <span className="notification-copy">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{new Date(notification.createdAt).toLocaleString()}</small>
                        </span>
                        {!notification.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button type="button" className="icon-button neutral hidden-mobile" aria-label="Help">
            <span className="material-symbols-outlined">help</span>
          </button>
          <label className="acting-user-picker">
            <span>Acting as</span>
            <select
              value={currentUser?.employeeId ?? ''}
              disabled={users.length === 0}
              onChange={(event) => {
                if (activeTab === 'teamqueue' || activeTab === 'approvals') setQueueLoading(true)
                setCurrentUser(users.find((user) => user.employeeId === event.target.value) ?? users[0] ?? null)
              }}
            >
              {users.length === 0 && <option value="">Loading org chart…</option>}
              {users.map((user) => (
                <option key={user.employeeId} value={user.employeeId}>
                  {initialsFor(user.name)} · {user.name} ({user.department})
                </option>
              ))}
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
            {intakeFormOpen && currentUser && <RequestCreator
              apiBaseUrl={apiBaseUrl}
              currentUserId={currentUser.employeeId}
              requestTypes={requestTypes}
              onSubmitted={(message) => {
                setNotice(message)
                setActiveTab('myrequests')
                setIntakeFormOpen(false)
              }}
            />}
          </section>

          <section className={`tab-pane ${activeTab === 'myrequests' ? 'visible' : 'hidden'}`}>
            <MyRequestsView requests={myRequests} searchTerm={searchTerm} loading={myRequestsLoading} />
          </section>

          <section className={`tab-pane ${activeTab === 'teamqueue' ? 'visible' : 'hidden'}`}>
            {shouldShowApprovals ? (
              <ApprovalsView
                approvalCards={queue}
                searchTerm={searchTerm}
                handleBulkApproveAll={handleBulkApproveAll}
                handleRejectOpen={handleRejectOpen}
                handleApprove={(item) => { void decide(item, 'approve') }}
                loading={queueLoading}
              />
            ) : (
              <TeamQueueView
                apiBaseUrl={apiBaseUrl}
                currentUserId={currentUser?.employeeId ?? ''}
                commentMode={commentMode}
                setCommentMode={setCommentMode}
                showToast={showToast}
                notice={notice}
                loading={fulfillmentLoading}
                queue={fulfillmentQueue}
                searchTerm={searchTerm}
                onRefresh={refreshFulfillmentQueue}
                onAssign={(requestId) => currentUser && void runFulfillmentAction(
                  () => assignFulfillmentRequest(apiBaseUrl, currentUser.employeeId, requestId),
                  `${requestId} assigned to you.`,
                )}
                onResolve={(requestId) => currentUser && void runFulfillmentAction(
                  () => resolveFulfillmentRequest(apiBaseUrl, currentUser.employeeId, requestId),
                  `${requestId} marked resolved.`,
                )}
                onClose={(requestId) => currentUser && void runFulfillmentAction(
                  () => closeFulfillmentRequest(apiBaseUrl, currentUser.employeeId, requestId),
                  `${requestId} closed.`,
                )}
                onComment={(requestId, body, visibility) => currentUser && void runFulfillmentAction(
                  () => addFulfillmentComment(apiBaseUrl, currentUser.employeeId, requestId, body, visibility),
                  'Comment posted to the fulfillment audit trail.',
                )}
              />
            )}
          </section>

          <section className={`tab-pane ${activeTab === 'approvals' ? 'visible' : 'hidden'}`}>
            <ApprovalsView
              approvalCards={queue}
              searchTerm={searchTerm}
              handleBulkApproveAll={handleBulkApproveAll}
              handleRejectOpen={handleRejectOpen}
              handleApprove={(item) => { void decide(item, 'approve') }}
              loading={queueLoading}
            />
          </section>

          <section className={`tab-pane ${activeTab === 'reports' ? 'visible' : 'hidden'}`}>
            <ReportsView
              apiBaseUrl={apiBaseUrl}
              actorId={currentUser?.employeeId ?? ''}
              showToast={showToast}
            />
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
