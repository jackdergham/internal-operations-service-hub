export type FulfillmentQueueItem = {
  requestId: string
  requesterId: string
  requestTypeId: string
  description: string
  status: string
  queue: string
  assignedFulfillerId: string | null
  createdAt: string
}

export type FulfillmentComment = {
  id: string
  requestId: string
  authorId: string
  body: string
  visibility: 'internal' | 'requester-visible'
  createdAt: string
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string }
  return new Error(payload.message ?? fallback)
}

async function fulfillmentRequest(
  apiBaseUrl: string,
  actorId: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}/fulfillment${path}`, {
    ...options,
    headers: { 'x-actor-id': actorId, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  if (!response.ok) throw await readError(response, 'The fulfillment request failed.')
  return response
}

export async function listFulfillmentQueue(apiBaseUrl: string, actorId: string): Promise<FulfillmentQueueItem[]> {
  const response = await fulfillmentRequest(apiBaseUrl, actorId, '/queue')
  return response.json() as Promise<FulfillmentQueueItem[]>
}

export async function listFulfillmentComments(apiBaseUrl: string, actorId: string, requestId: string): Promise<FulfillmentComment[]> {
  const response = await fulfillmentRequest(apiBaseUrl, actorId, `/${requestId}/comments`)
  return response.json() as Promise<FulfillmentComment[]>
}

export async function addFulfillmentComment(
  apiBaseUrl: string,
  actorId: string,
  requestId: string,
  body: string,
  visibility: FulfillmentComment['visibility'],
): Promise<void> {
  await fulfillmentRequest(apiBaseUrl, actorId, `/${requestId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, visibility }),
  })
}

export async function assignFulfillmentRequest(apiBaseUrl: string, actorId: string, requestId: string): Promise<void> {
  await fulfillmentRequest(apiBaseUrl, actorId, `/${requestId}/assign`, { method: 'POST' })
}

export async function resolveFulfillmentRequest(apiBaseUrl: string, actorId: string, requestId: string): Promise<void> {
  await fulfillmentRequest(apiBaseUrl, actorId, `/${requestId}/resolve`, { method: 'POST' })
}

export async function closeFulfillmentRequest(apiBaseUrl: string, actorId: string, requestId: string): Promise<void> {
  await fulfillmentRequest(apiBaseUrl, actorId, `/${requestId}/close`, { method: 'POST' })
}
