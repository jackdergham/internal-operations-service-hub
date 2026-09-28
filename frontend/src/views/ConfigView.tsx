import { useEffect, useMemo, useState } from 'react'
import type { Actor } from '../api/directoryApi'
import {
  listRequestTypeConfigs,
  listWorkflowVersions,
  publishRequestTypeConfig,
  saveRequestTypeConfig,
} from '../api/configApi'
import type { ApprovalStep, FormField, RequestTypeConfig, WorkflowVersion } from '../api/configApi'

type Props = {
  apiBaseUrl: string
  currentUser: Actor | null
  showToast: (message: string) => void
}

const emptyConfig = (id: string): RequestTypeConfig => ({
  id,
  name: 'New request type',
  department: 'IT',
  schema: { fields: [], required: [] },
  routingMode: 'approval',
  destinationQueue: 'IT',
  approvalChain: [{ type: 'manager' }],
  currentVersion: 0,
  updatedAt: new Date().toISOString(),
})

function cloneConfig(config: RequestTypeConfig): RequestTypeConfig {
  return JSON.parse(JSON.stringify(config)) as RequestTypeConfig
}

export default function ConfigView({ apiBaseUrl, currentUser, showToast }: Props) {
  const [configs, setConfigs] = useState<RequestTypeConfig[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<RequestTypeConfig | null>(null)
  const [versions, setVersions] = useState<WorkflowVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAdmin = currentUser?.roles.includes('admin') ?? false

  useEffect(() => {
    if (!currentUser || !isAdmin) return
    setLoading(true)
    listRequestTypeConfigs(apiBaseUrl, currentUser.employeeId)
      .then((items) => {
        setConfigs(items)
        setSelectedId((current) => current || items[0]?.id || '')
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load configuration'))
      .finally(() => setLoading(false))
  }, [apiBaseUrl, currentUser, isAdmin, showToast])

  const selected = useMemo(() => configs.find((item) => item.id === selectedId) ?? null, [configs, selectedId])

  useEffect(() => {
    setDraft(selected ? cloneConfig(selected) : null)
  }, [selected])

  useEffect(() => {
    if (!currentUser || !selectedId || !isAdmin) return
    listWorkflowVersions(apiBaseUrl, currentUser.employeeId, selectedId)
      .then(setVersions)
      .catch(() => setVersions([]))
  }, [apiBaseUrl, currentUser, selectedId, isAdmin])

  const updateDraft = (update: (current: RequestTypeConfig) => RequestTypeConfig) => {
    setDraft((current) => current ? update(current) : current)
  }

  const updateField = (fieldId: string, update: Partial<FormField>) => {
    updateDraft((current) => ({
      ...current,
      schema: { ...current.schema, fields: current.schema.fields.map((field) => field.key === fieldId ? { ...field, ...update } : field) },
    }))
  }

  const removeField = (fieldId: string) => {
    updateDraft((current) => ({
      ...current,
      schema: {
        fields: current.schema.fields.filter((field) => field.key !== fieldId),
        required: current.schema.required.filter((key) => key !== fieldId),
      },
    }))
  }

  const addCustomField = () => {
    updateDraft((current) => {
      const key = `customField${current.schema.fields.length + 1}`
      return {
        ...current,
        schema: { ...current.schema, fields: [...current.schema.fields, { key, label: `Custom field ${current.schema.fields.length + 1}`, type: 'text' }] },
      }
    })
  }

  const addApprovalStep = () => updateDraft((current) => ({ ...current, approvalChain: [...current.approvalChain, { type: 'manager' }] }))
  const removeApprovalStep = (index: number) => updateDraft((current) => ({ ...current, approvalChain: current.approvalChain.filter((_, i) => i !== index) }))

  const save = async () => {
    if (!draft || !currentUser) return
    setSaving(true)
    try {
      const saved = await saveRequestTypeConfig(apiBaseUrl, currentUser.employeeId, {
        id: draft.id,
        name: draft.name,
        department: draft.department,
        schema: draft.schema,
        routingMode: draft.routingMode,
        destinationQueue: draft.destinationQueue,
        approvalChain: draft.approvalChain,
      })
      setConfigs((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved])
      setDraft(saved)
      showToast('Configuration saved as draft.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Configuration could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (!draft || !currentUser) return
    setSaving(true)
    try {
      const saved = await saveRequestTypeConfig(apiBaseUrl, currentUser.employeeId, {
        id: draft.id,
        name: draft.name,
        department: draft.department,
        schema: draft.schema,
        routingMode: draft.routingMode,
        destinationQueue: draft.destinationQueue,
        approvalChain: draft.approvalChain,
      })
      const version = await publishRequestTypeConfig(apiBaseUrl, currentUser.employeeId, saved.id)
      setConfigs((current) => current.map((item) => item.id === saved.id ? saved : item))
      setDraft(saved)
      setVersions((current) => [version, ...current])
      showToast(`Workflow version ${version.version} published.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Workflow could not be published.')
    } finally {
      setSaving(false)
    }
  }

  const createRequestType = () => {
    const id = `new-request-${Date.now()}`
    const created = emptyConfig(id)
    setConfigs((current) => [...current, created])
    setSelectedId(id)
    showToast('New request type draft created.')
  }

  if (!isAdmin) {
    return <div className="empty-state"><strong>Admin access required</strong><span>Only an admin can edit request types and workflow configuration.</span></div>
  }

  return (
    <>
      <div className="section-header-row">
        <div>
          <div className="eyebrow-label">WORKFLOW ORCHESTRATION</div>
          <h2>Queue Owner &amp; Routing Configuration</h2>
        </div>
        <div className="banner-actions">
          <button type="button" className="secondary-action" onClick={createRequestType} disabled={loading}>New request type</button>
          <button type="button" className="primary-action" onClick={() => void publish()} disabled={!draft || saving}>
            <span className="material-symbols-outlined">publish</span>
            <span>{saving ? 'Saving…' : `Publish Workflow Version ${draft?.currentVersion ? draft.currentVersion + 1 : 1}`}</span>
          </button>
        </div>
      </div>

      <div className="config-layout">
        <div className="config-panel">
          <div className="table-header narrow">
            <h3>Request types</h3>
            <span>{configs.length} configured</span>
          </div>
          <div className="field-list">
            {configs.map((config) => (
              <button type="button" key={config.id} className={`field-row ${config.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(config.id)}>
                <div className="field-copy"><strong>{config.name}</strong><span>{config.department} · {config.routingMode === 'direct' ? 'Direct' : `${config.approvalChain.length}-step approval`}</span></div>
                <div className="field-badge">v{config.currentVersion}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="config-panel">
          {draft ? (
            <>
              <div className="table-header narrow"><h3>Request type</h3><span>{draft.id}</span></div>
              <div className="config-form">
                <label>Name<input value={draft.name} onChange={(e) => updateDraft((c) => ({ ...c, name: e.target.value }))} /></label>
                <label>Department<input value={draft.department} onChange={(e) => updateDraft((c) => ({ ...c, department: e.target.value }))} /></label>
                <label>Destination queue<input value={draft.destinationQueue} onChange={(e) => updateDraft((c) => ({ ...c, destinationQueue: e.target.value }))} /></label>
              </div>

              <div className="table-header narrow"><h3>Field builder</h3><button type="button" className="secondary-action small" onClick={addCustomField}>+ New field</button></div>
              <div className="field-list">
                {draft.schema.fields.map((field) => (
                  <div key={field.key} className="field-row">
                    <div className="field-copy">
                      <input value={field.label} onChange={(e) => updateField(field.key, { label: e.target.value })} aria-label={`${field.key} label`} />
                      <span>{field.key} · {draft.schema.required.includes(field.key) ? 'Required' : 'Optional'}</span>
                    </div>
                    <select value={field.type} onChange={(e) => updateField(field.key, { type: e.target.value })} aria-label={`${field.key} type`}>
                      <option value="text">Text</option><option value="date">Date</option><option value="number">Number</option><option value="select">Select</option>
                    </select>
                    <button type="button" className="icon-button neutral small" onClick={() => removeField(field.key)} aria-label={`Delete ${field.label}`}><span className="material-symbols-outlined">delete</span></button>
                  </div>
                ))}
              </div>

              <div className="table-header narrow"><h3>Routing topology</h3></div>
              <div className="mode-toggle">
                <button type="button" className={draft.routingMode === 'approval' ? 'active' : ''} onClick={() => updateDraft((c) => ({ ...c, routingMode: 'approval' }))}>Approval chain</button>
                <button type="button" className={draft.routingMode === 'direct' ? 'active' : ''} onClick={() => updateDraft((c) => ({ ...c, routingMode: 'direct', approvalChain: [] }))}>Direct to queue</button>
              </div>

              {draft.routingMode === 'approval' && (
                <div className="route-steps">
                  {draft.approvalChain.map((step, index) => (
                    <div key={`${index}-${step.type}`} className="route-step">
                      <span>{index + 1}</span>
                      <div><strong>{step.type === 'manager' ? 'Requester manager' : step.type === 'department-head' ? 'Department head' : 'Specific approver'}</strong><small>Sequential approval step</small></div>
                      {step.type === 'specific-user' && <input placeholder="employee id" value={step.actorId ?? ''} onChange={(e) => updateDraft((c) => ({ ...c, approvalChain: c.approvalChain.map((candidate, i) => i === index ? { ...candidate, actorId: e.target.value } : candidate) }))} />}
                      <select value={step.type} onChange={(e) => updateDraft((c) => ({ ...c, approvalChain: c.approvalChain.map((candidate, i) => i === index ? { type: e.target.value as ApprovalStep['type'], actorId: e.target.value === 'specific-user' ? candidate.actorId : undefined } : candidate) }))}>
                        <option value="manager">Manager</option><option value="department-head">Department head</option><option value="specific-user">Specific user</option>
                      </select>
                      <button type="button" className="icon-button neutral small" onClick={() => removeApprovalStep(index)} aria-label="Remove approval step"><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  ))}
                  <button type="button" className="secondary-action small" onClick={addApprovalStep}>+ Add approval step</button>
                </div>
              )}

              <div className="config-save-row"><button type="button" className="secondary-action" onClick={() => void save()} disabled={saving}>Save draft</button><span>Published version: v{draft.currentVersion}</span></div>

              <div className="table-header narrow"><h3>Published workflow history</h3></div>
              <div className="version-list">{versions.length === 0 ? <span>No published versions yet.</span> : versions.map((version) => <div key={version.id}><strong>v{version.version}</strong><span>{version.routingMode === 'direct' ? 'Direct' : `${version.approvalChain.length}-step approval`} · {new Date(version.publishedAt).toLocaleString()}</span></div>)}</div>
            </>
          ) : <span>Select a request type to configure it.</span>}
        </div>
      </div>
    </>
  )
}
