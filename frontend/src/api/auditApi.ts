export type AuditStatusEvent = {
  status: string
  source: string
  createdAt: string
}

export type AuditApprovalStep = {
  stepNumber: number
  approverId: string
  status: string
  decidedBy?: string
  decidedAt?: string
  rejectionReason?: string
}

export type AuditRoutingDecision = {
  status: string
  destinationQueue: string
  approvalSteps: AuditApprovalStep[]
}

export type AuditComment = {
  id: string
  authorId: string
  body: string
  visibility: 'internal' | 'requester-visible'
  createdAt: string
}

export type RequestAudit = {
  requestId: string
  requesterId: string
  requestTypeId: string
  status: string
  createdAt: string
  statusEvents: AuditStatusEvent[]
  routingDecision: AuditRoutingDecision | null
  comments: AuditComment[]
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string }
  return new Error(payload.message ?? fallback)
}

export async function fetchRequestAudit(apiBaseUrl: string, actorId: string, requestId: string): Promise<RequestAudit> {
  const response = await fetch(`${apiBaseUrl}/requests/${requestId}/audit`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw await readError(response, 'The audit trail could not be loaded.')
  return response.json() as Promise<RequestAudit>
}
