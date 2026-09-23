export type RequestType = {
  id: string
  name: string
  department: string
  schema: {
    fields?: Array<{ key: string; label: string; type: string }>
    required?: string[]
  }
}

export type AssistSuggestion = {
  requestTypeId: string | null
  formData: Record<string, unknown>
  missingFields: string[]
  warnings: string[]
  confidence: 'high' | 'medium' | 'low'
  source: 'local' | 'gemini'
}

type RequestResponse = {
  request: {
    id: string
    status: string
  }
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string }
  return new Error(payload.message ?? fallback)
}

export async function listRequestTypes(apiBaseUrl: string): Promise<RequestType[]> {
  const response = await fetch(`${apiBaseUrl}/request-types`)
  if (!response.ok) throw await readError(response, 'Request types could not be loaded')
  return response.json() as Promise<RequestType[]>
}

export async function assistRequest(
  apiBaseUrl: string,
  actorId: string,
  description: string,
): Promise<AssistSuggestion> {
  const response = await fetch(`${apiBaseUrl}/requests/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-actor-id': actorId },
    body: JSON.stringify({ requesterId: actorId, description }),
  })
  if (!response.ok) throw await readError(response, 'The request could not be assisted.')
  return response.json() as Promise<AssistSuggestion>
}

export async function submitRequest(
  apiBaseUrl: string,
  actorId: string,
  requestTypeId: string,
  description: string,
  formData: Record<string, string>,
): Promise<RequestResponse> {
  const response = await fetch(`${apiBaseUrl}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-actor-id': actorId },
    body: JSON.stringify({
      requesterId: actorId,
      requestTypeId,
      description,
      formData,
      idempotencyKey: crypto.randomUUID(),
    }),
  })
  if (!response.ok) throw await readError(response, 'The request could not be submitted.')
  return response.json() as Promise<RequestResponse>
}
