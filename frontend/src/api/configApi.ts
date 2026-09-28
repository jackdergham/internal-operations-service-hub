export type RoutingMode = 'direct' | 'approval'
export type ApprovalStepType = 'manager' | 'department-head' | 'specific-user'

export type FormField = { key: string; label: string; type: string }
export type ApprovalStep = { type: ApprovalStepType; actorId?: string }

export type RequestTypeConfig = {
  id: string
  name: string
  department: string
  schema: { fields: FormField[]; required: string[] }
  routingMode: RoutingMode
  destinationQueue: string
  approvalChain: ApprovalStep[]
  currentVersion: number
  updatedAt: string
}

export type WorkflowVersion = {
  id: string
  requestTypeId: string
  version: number
  routingMode: RoutingMode
  destinationQueue: string
  approvalChain: ApprovalStep[]
  publishedBy: string
  publishedAt: string
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string }
  return new Error(payload.message ?? fallback)
}

export async function listRequestTypeConfigs(apiBaseUrl: string, actorId: string): Promise<RequestTypeConfig[]> {
  const response = await fetch(`${apiBaseUrl}/admin/config/request-types`, { headers: { 'x-actor-id': actorId } })
  if (!response.ok) throw await readError(response, 'Request type configuration could not be loaded')
  return response.json() as Promise<RequestTypeConfig[]>
}

export async function saveRequestTypeConfig(
  apiBaseUrl: string,
  actorId: string,
  config: Omit<RequestTypeConfig, 'currentVersion' | 'updatedAt'>,
): Promise<RequestTypeConfig> {
  const response = await fetch(`${apiBaseUrl}/admin/config/request-types/${encodeURIComponent(config.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-actor-id': actorId },
    body: JSON.stringify(config),
  })
  if (!response.ok) throw await readError(response, 'Request type configuration could not be saved')
  return response.json() as Promise<RequestTypeConfig>
}

export async function publishRequestTypeConfig(apiBaseUrl: string, actorId: string, requestTypeId: string): Promise<WorkflowVersion> {
  const response = await fetch(`${apiBaseUrl}/admin/config/request-types/${encodeURIComponent(requestTypeId)}/publish`, {
    method: 'POST',
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw await readError(response, 'Workflow version could not be published')
  return response.json() as Promise<WorkflowVersion>
}

export async function listWorkflowVersions(apiBaseUrl: string, actorId: string, requestTypeId: string): Promise<WorkflowVersion[]> {
  const response = await fetch(`${apiBaseUrl}/admin/config/request-types/${encodeURIComponent(requestTypeId)}/versions`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw await readError(response, 'Workflow versions could not be loaded')
  return response.json() as Promise<WorkflowVersion[]>
}
