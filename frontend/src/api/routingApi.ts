export type QueueResponse = {
  decisionId: string
  stepId: string
  requestId: string
  requesterId: string
  requestTypeId: string
  status: 'Pending' | 'Approved' | 'Rejected'
  submittedAt: string
}

export async function listApprovalQueue(apiBaseUrl: string, approverId: string): Promise<QueueResponse[]> {
  const response = await fetch(`${apiBaseUrl}/routing-decisions/queue?approverId=${approverId}`)
  if (!response.ok) throw new Error('Queue request failed')
  return response.json() as Promise<QueueResponse[]>
}

export async function decideApproval(
  apiBaseUrl: string,
  decisionId: string,
  stepId: string,
  approverId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/routing-decisions/${decisionId}/steps/${stepId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approverId, decision, ...(reason ? { reason } : {}) }),
  })
  if (!response.ok) throw new Error('The backend rejected this decision.')
}
