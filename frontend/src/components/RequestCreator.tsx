import { useState } from 'react'
import type { FormEvent } from 'react'
import { assistRequest as requestAssist, submitRequest as createRequest } from '../api/intakeApi'
import type { AssistSuggestion, RequestType } from '../api/intakeApi'

type Props = {
  apiBaseUrl: string
  currentUserId: string
  requestTypes: RequestType[]
  onSubmitted: (message: string) => void
}

export default function RequestCreator({ apiBaseUrl, currentUserId, requestTypes, onSubmitted }: Props) {
  const [aiDescription, setAiDescription] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<AssistSuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedType, setSelectedType] = useState('new-laptop')
  const [description, setDescription] = useState('Need a new workstation for data pipeline work.')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedRequestType = requestTypes.find((requestType) => requestType.id === selectedType)
  const configuredFields = selectedRequestType?.schema.fields ?? []

  const assistRequest = async () => {
    setAiLoading(true)
    setNotice('')

    try {
      const suggestion = await requestAssist(apiBaseUrl, currentUserId, aiDescription)
      setAiSuggestion(suggestion)
      if (suggestion.requestTypeId) setSelectedType(suggestion.requestTypeId)
      setFormData((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(suggestion.formData).map(([key, value]) => [key, String(value)])),
      }))
      setDescription(aiDescription)
      setNotice(suggestion.warnings.length > 0
        ? suggestion.warnings.join(' ')
        : 'Suggested values applied. Review the form before submitting.')
    } catch (error) {
      setNotice(error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'Could not reach the AI assistance service. You can complete the form manually.')
    } finally {
      setAiLoading(false)
    }
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')

    try {
      const payload = await createRequest(apiBaseUrl, currentUserId, selectedType, description, formData)

      onSubmitted(`Request ${payload.request.id} created with status ${payload.request.status}.`)
    } catch (error) {
      setNotice(error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'Could not reach the Intake API. Start the NestJS server and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="table-panel" style={{ marginTop: 24 }}>
      <div className="table-header">
        <div>
          <div className="eyebrow-label">LIVE INTAKE API</div>
          <h3>Submit a routed request</h3>
        </div>
      </div>
      <div className="field-grid" style={{ marginBottom: 18 }}>
        <label className="field-label" style={{ gridColumn: '1 / -1' }}>
          <span>Describe what you need</span>
          <textarea
            rows={3}
            value={aiDescription}
            onChange={(event) => setAiDescription(event.target.value)}
            placeholder="Example: I need a laptop for development work."
          />
        </label>
        <div className="action-row" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="secondary-action" onClick={() => void assistRequest()} disabled={aiLoading || !aiDescription.trim()}>
            <span className="material-symbols-outlined">auto_awesome</span>
            <span>{aiLoading ? 'Preparing form...' : 'Fill form with AI'}</span>
          </button>
          {aiSuggestion && <span className="field-hint">Source: {aiSuggestion.source} · Confidence: {aiSuggestion.confidence}</span>}
        </div>
      </div>
      <form className="field-grid" onSubmit={submitRequest}>
        <label className="field-label compact">
          <span>Request type</span>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            {requestTypes.length > 0
              ? requestTypes.map((requestType) => <option key={requestType.id} value={requestType.id}>{requestType.name}</option>)
              : <option value="new-laptop">New laptop / equipment</option>}
          </select>
        </label>
        {configuredFields.map((field) => (
          <label className="field-label compact" key={field.key}>
            <span>{field.label}</span>
            <input
              required={selectedRequestType?.schema.required?.includes(field.key) ?? false}
              type={field.type}
              value={formData[field.key] ?? ''}
              onChange={(event) => setFormData((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        <label className="field-label" style={{ gridColumn: '1 / -1' }}>
          <span>Description</span>
          <textarea required rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {aiSuggestion && aiSuggestion.missingFields.length > 0 && (
          <div className="empty-state" role="status" style={{ gridColumn: '1 / -1' }}>
            Review missing fields: {aiSuggestion.missingFields.join(', ')}.
          </div>
        )}
        <div className="action-row" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="primary-action" disabled={submitting}>
            <span className="material-symbols-outlined">send</span>
            <span>{submitting ? 'Submitting...' : 'Submit to Intake'}</span>
          </button>
        </div>
      </form>
      {notice && <div className="empty-state" role="status">{notice}</div>}
    </div>
  )
}
