export type TabKey = 'catalog' | 'myrequests' | 'teamqueue' | 'approvals' | 'reports' | 'config'
export type CommentMode = 'internal' | 'reply'
export type RouteMode = 'seq' | 'direct'

export type DynamicField = {
  id: string
  name: string
  type: string
  required: boolean
}

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
