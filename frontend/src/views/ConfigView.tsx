import { useState } from 'react'
import { initialFields, routeSteps } from '../data'
import type { DynamicField, RouteMode } from '../types'

type Props = {
  showToast: (message: string) => void
}

export default function ConfigView({ showToast }: Props) {
  const [fields, setFields] = useState<DynamicField[]>(initialFields)
  const [routeMode, setRouteMode] = useState<RouteMode>('seq')

  const addCustomField = () => {
    setFields((current) => [
      ...current,
      {
        id: `field-${Date.now()}`,
        name: `Custom User Property #${current.length + 1}`,
        type: 'TEXT',
        required: false,
      },
    ])
    showToast('Added new custom schema field')
  }

  return (
    <>
      <div className="section-header-row">
        <div>
          <div className="eyebrow-label">WORKFLOW ORCHESTRATION</div>
          <h2>Queue Owner &amp; Routing Configuration</h2>
        </div>
        <button type="button" className="primary-action" onClick={() => showToast('Workflow specification saved!')}>
          <span className="material-symbols-outlined">save</span>
          <span>Publish Workflow Version 3.4</span>
        </button>
      </div>

      <div className="config-layout">
        <div className="config-panel">
          <div className="table-header narrow">
            <h3>Field builder</h3>
            <button type="button" className="secondary-action small" onClick={addCustomField}>
              <span className="material-symbols-outlined">add</span>
              <span>New field</span>
            </button>
          </div>

          <div className="field-list">
            {fields.map((field) => (
              <div key={field.id} className="field-row">
                <div className="field-drag">
                  <span className="material-symbols-outlined">drag_indicator</span>
                </div>
                <div className="field-copy">
                  <strong>{field.name}</strong>
                  <span>{field.type} • {field.required ? 'Required' : 'Optional'}</span>
                </div>
                <div className="field-badge">{field.type}</div>
                <button
                  type="button"
                  className="icon-button neutral small"
                  onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="config-panel">
          <div className="table-header narrow">
            <h3>Routing topology</h3>
          </div>

          <div className="mode-toggle">
            <button type="button" className={routeMode === 'seq' ? 'active' : ''} onClick={() => { setRouteMode('seq'); showToast('Switched to sequential routing mode'); }}>Sequential</button>
            <button type="button" className={routeMode === 'direct' ? 'active' : ''} onClick={() => { setRouteMode('direct'); showToast('Switched to Direct-to-Queue bypass mode'); }}>Direct</button>
          </div>

          <div className={`route-steps ${routeMode === 'direct' ? 'muted' : ''}`}>
            {routeSteps.map((step, index) => (
              <div key={step} className={`route-step ${index === 2 ? 'focus' : ''}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step}</strong>
                  <small>{index === 0 ? 'Auto-validate' : index === 1 ? 'Manager gate' : index === 2 ? 'Assign queue' : index === 3 ? 'Worker dispatch' : 'Closeout'}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
