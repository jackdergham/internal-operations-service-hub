export type QueueResponse = {
  decisionId: string
  stepId: string
  requestId: string
  requesterId: string
  requestTypeId: string
  status: 'Pending' | 'Approved' | 'Rejected'
  submittedAt: string
}

export async function listApprovalQueue(apiBaseUrl: string, actorId: string): Promise<QueueResponse[]> {
  const response = await fetch(`${apiBaseUrl}/routing-decisions/queue`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw new Error('Queue request failed')
  return response.json() as Promise<QueueResponse[]>
}

export async function decideApproval(
  apiBaseUrl: string,
  decisionId: string,
  stepId: string,
  actorId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/routing-decisions/${decisionId}/steps/${stepId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-actor-id': actorId },
    body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
  })
  if (!response.ok) throw new Error('The backend rejected this decision.')
}
