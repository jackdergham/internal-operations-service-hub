import type { DynamicField } from './types'

export const tabs = [
  { key: 'catalog', label: 'Services & Requests', icon: 'grid_view' },
  { key: 'myrequests', label: 'My Requests', icon: 'receipt_long' },
  { key: 'teamqueue', label: 'Approvals & Fulfillment', icon: 'fact_check' },
  { key: 'reports', label: 'Analytics & Reports', icon: 'monitoring' },
  { key: 'config', label: 'Configuration Settings', icon: 'tune' },
] as const

export const myRequestRows = [
  { id: 'OPS-1024', title: 'Laptop refresh', service: 'IT / Hardware', owner: 'Dave Miller', status: 'In Fulfillment', state: 'Pending' },
  { id: 'OPS-1018', title: 'Parental leave request', service: 'HR / Leave', owner: 'Maya Patel', status: 'Manager Approved', state: 'Approved' },
  { id: 'OPS-1011', title: 'Desk relocation', service: 'Facilities / Workspace', owner: 'Facilities Ops', status: 'Scheduled', state: 'Pending' },
  { id: 'OPS-1007', title: 'Corporate card uplift', service: 'Finance / Cards', owner: 'Finance Ops', status: 'Awaiting review', state: 'Pending' },
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
