export type TabKey = 'catalog' | 'myrequests' | 'teamqueue' | 'approvals' | 'reports' | 'config'
export type CommentMode = 'internal' | 'reply'

export type RoutingQueueItem = {
  id: string
  requestId: string
  title: string
  requester: string
  submitted: string
  category: string
  status: 'Pending' | 'Approved' | 'Rejected'
  decisionId: string
  stepId: string
}
