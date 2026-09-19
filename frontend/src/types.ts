export type TabKey = 'catalog' | 'myrequests' | 'teamqueue' | 'approvals' | 'reports' | 'config'
export type CatalogFilter = 'all' | 'it' | 'hr' | 'facilities' | 'finance' | 'legal'
export type CommentMode = 'internal' | 'reply'
export type RouteMode = 'seq' | 'direct'

export type CatalogItem = {
  id: string
  name: string
  description: string
  category: Exclude<CatalogFilter, 'all'>
  badge: string
  icon: string
  accent: string
}

export type ApprovalItem = {
  id: string
  ticket: string
  requester: string
  title: string
  detail: string
  amount: string
  priority: 'High' | 'Medium' | 'Low'
}

export type DynamicField = {
  id: string
  name: string
  type: string
  required: boolean
}
