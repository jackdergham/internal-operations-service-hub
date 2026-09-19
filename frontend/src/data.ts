import type { ApprovalItem, CatalogItem, DynamicField } from './types'

export const tabs = [
  { key: 'catalog', label: 'Services & Requests', icon: 'grid_view' },
  { key: 'myrequests', label: 'My Requests', icon: 'receipt_long' },
  { key: 'teamqueue', label: 'Approvals & Fulfillment', icon: 'fact_check' },
  { key: 'reports', label: 'Analytics & Reports', icon: 'monitoring' },
  { key: 'config', label: 'Configuration Settings', icon: 'tune' },
] as const

export const catalogCards: CatalogItem[] = [
  { id: 'laptop', name: 'New Laptop & Peripherals', description: 'Standard issue developer MacBook M3 Pro, dual monitors, mechanical docks, or ergonomic workstation kit.', category: 'it', badge: 'IT & Hardware', icon: 'laptop_mac', accent: 'primary' },
  { id: 'pto', name: 'PTO & Leave Exception', description: 'Emergency rollover, sabbatical applications, parental leaves, or exceptional bereavement support.', category: 'hr', badge: 'People & HR', icon: 'beach_access', accent: 'soft' },
  { id: 'relocation', name: 'Desk Relocation & Ergonomics', description: 'Move desk pods across 4th floor, adjust standing converters, or ergonomic chair replacement.', category: 'facilities', badge: 'Facilities & Workplace', icon: 'desk', accent: 'soft' },
  { id: 'cloud', name: 'Software License & Cloud Access', description: 'AWS IAM elevated permissions, Datadog prod viewer tokens, Figma Enterprise, or GitHub Copilot seats.', category: 'it', badge: 'IT & Hardware', icon: 'cloud_done', accent: 'soft' },
  { id: 'card', name: 'Corporate Card Limit Increase', description: 'Temporary expense threshold uplift for client engagements, SaaS renewals, or emergency vendor tooling.', category: 'finance', badge: 'Finance & Cards', icon: 'credit_card', accent: 'soft' },
  { id: 'nda', name: 'Vendor NDA & Contract Review', description: 'Standard mutual non-disclosure agreement vetting, master service agreement addendums, and DPA verification.', category: 'legal', badge: 'Legal & Compliance', icon: 'gavel', accent: 'soft' },
  { id: 'badge', name: 'Office Badge & Keycard Provisioning', description: 'New hire badge printing, lost keycard replacement, weekend building pass, and server cage badge access.', category: 'facilities', badge: 'Facilities & Workplace', icon: 'badge', accent: 'soft' },
  { id: 'ergonomic', name: 'Ergonomic Desk Assessment', description: 'On-site ergonomic specialist review for lumbar support, monitor arms, vertical mice, and standing mats.', category: 'facilities', badge: 'Facilities & Workplace', icon: 'chair_alt', accent: 'soft' },
]

export const myRequestRows = [
  { id: 'OPS-1024', title: 'Laptop refresh', service: 'IT / Hardware', owner: 'Dave Miller', status: 'In Fulfillment', state: 'Pending' },
  { id: 'OPS-1018', title: 'Parental leave request', service: 'HR / Leave', owner: 'Maya Patel', status: 'Manager Approved', state: 'Approved' },
  { id: 'OPS-1011', title: 'Desk relocation', service: 'Facilities / Workspace', owner: 'Facilities Ops', status: 'Scheduled', state: 'Pending' },
  { id: 'OPS-1007', title: 'Corporate card uplift', service: 'Finance / Cards', owner: 'Finance Ops', status: 'Awaiting review', state: 'Pending' },
]

export const teamQueueRows = [
  { id: 'REQ-1842', title: 'Software license escalation', requester: 'Nora Chen', queue: 'IT Access', submitted: 'Today, 09:13', risk: 'High' },
  { id: 'REQ-1838', title: 'Emergency PTO exception', requester: 'Maya Patel', queue: 'People Ops', submitted: 'Today, 08:41', risk: 'Medium' },
  { id: 'REQ-1835', title: 'Badge reissue request', requester: 'Ethan Brooks', queue: 'Facilities', submitted: 'Today, 08:12', risk: 'Low' },
  { id: 'REQ-1828', title: 'Hardware dock replacement', requester: 'Jordan Lee', queue: 'Endpoint Support', submitted: 'Yesterday, 16:05', risk: 'Medium' },
]

export const initialApprovals: ApprovalItem[] = [
  { id: 'approval-1', ticket: 'REQ-2046', requester: 'Alicia Hart', title: 'Cloud access escalation', detail: 'Production AWS IAM escalation for staging diagnostics bridge.', amount: 'High risk', priority: 'High' },
  { id: 'approval-2', ticket: 'REQ-2041', requester: 'Sofia Nguyen', title: 'Budget revision for on-site training', detail: 'Regional onboarding cost increase approved by department sponsor.', amount: '$2,400', priority: 'Medium' },
  { id: 'approval-3', ticket: 'REQ-2039', requester: 'Marcus Lee', title: 'Vendor contractor onboarding', detail: 'Security review completed; waiting on legal final sign-off.', amount: '3rd party', priority: 'Low' },
]

export const reportMetrics = [
  { label: 'Avg resolution time', value: '8.2h', delta: '+12%' },
  { label: 'Workflow completion', value: '93.7%', delta: '+3.8%' },
  { label: 'Escalations', value: '14', delta: '-19%' },
  { label: 'SLA breaches', value: '2.1%', delta: 'Stable' },
]

export const initialFields: DynamicField[] = [
  { id: 'field-1', name: 'Employee ID', type: 'TEXT', required: true },
  { id: 'field-2', name: 'Business Justification', type: 'LONGTEXT', required: true },
  { id: 'field-3', name: 'Approver Group', type: 'SELECT', required: false },
]

export const routeSteps = ['Intake Validation', 'Manager Review', 'Queue Assignment', 'Fulfillment', 'Closure']
