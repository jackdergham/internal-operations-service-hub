import type { CatalogFilter } from '../types'
import { catalogCards } from '../data'

type Props = {
  activeFilter: CatalogFilter
  searchTerm: string
  setSearchTerm: (next: string) => void
  handleSubmitRequest: () => void
  handleFilterChange: (filter: CatalogFilter) => void
  showToast: (message: string) => void
  visibleCatalog: typeof catalogCards
}

export default function CatalogView({
  activeFilter,
  searchTerm,
  setSearchTerm,
  handleSubmitRequest,
  handleFilterChange,
  showToast,
  visibleCatalog,
}: Props) {
  return (
    <>
      <div className="page-banner">
        <div>
          <div className="eyebrow-label">OPERATIONS CONTROL HUB</div>
          <h1>Service Orchestration &amp; Multi-Team Fulfillment</h1>
        </div>
        <div className="banner-actions">
          <div className="sync-pill">
            <span className="pulse-dot" />
            <span>Sync Engine: Active</span>
          </div>
          <button type="button" className="primary-action" onClick={handleSubmitRequest}>
            <span className="material-symbols-outlined">add</span>
            <span>Initiate Request</span>
          </button>
        </div>
      </div>

      <div className="catalog-top-grid">
        <div className="hero-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span className="material-symbols-outlined">smart_toy</span>
              <span>Submission workflow</span>
            </div>
            <span className="mini-badge success">Live</span>
          </div>

          <div className="request-builder">
            <label className="field-label">
              <span>Service selection</span>
              <select defaultValue="laptop">
                <option value="laptop">New Laptop &amp; Peripherals</option>
                <option value="pto">PTO &amp; Leave Exception</option>
                <option value="desk">Desk Relocation &amp; Ergonomics</option>
              </select>
            </label>

            <div className="field-grid">
              <label className="field-label compact">
                <span>Business unit</span>
                <select defaultValue="engineering">
                  <option value="engineering">Engineering</option>
                  <option value="security">Security</option>
                  <option value="support">Support</option>
                </select>
              </label>
              <label className="field-label compact">
                <span>Priority</span>
                <select defaultValue="normal">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>

            <label className="field-label">
              <span>Operational details</span>
              <textarea defaultValue="Need a new workstation for data pipeline work. Includes dual monitor kit and dock for remote support coverage." rows={4} />
            </label>

            <div className="action-row">
              <button type="button" className="secondary-action" onClick={() => showToast('Loaded blank custom ticket builder')}>
                <span className="material-symbols-outlined">edit_square</span>
                <span>Custom Form</span>
              </button>
              <button type="button" className="primary-action" onClick={handleSubmitRequest}>
                <span className="material-symbols-outlined">send</span>
                <span>Submit Request</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mini-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span className="material-symbols-outlined">insights</span>
              <span>Operational snapshot</span>
            </div>
          </div>

          <div className="mini-stats">
            <div className="mini-stat">
              <span className="stat-label">Open requests</span>
              <strong>742</strong>
            </div>
            <div className="mini-stat">
              <span className="stat-label">Avg cycle</span>
              <strong>8.2h</strong>
            </div>
            <div className="mini-stat">
              <span className="stat-label">Automation</span>
              <strong>64%</strong>
            </div>
          </div>

          <div className="mini-kpi">
            <div className="kpi-header">
              <span>Handling mix</span>
              <strong>Quarterly</strong>
            </div>
            <div className="progress-stack">
              <div className="progress-row"><span>IT</span><div className="bar"><i style={{ width: '76%' }} /></div><strong>76%</strong></div>
              <div className="progress-row"><span>HR</span><div className="bar"><i style={{ width: '58%' }} /></div><strong>58%</strong></div>
              <div className="progress-row"><span>Facilities</span><div className="bar"><i style={{ width: '44%' }} /></div><strong>44%</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="filter-pills">
          {(['all', 'it', 'hr', 'facilities', 'finance', 'legal'] as CatalogFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`filter-pill ${activeFilter === filter ? 'selected' : ''}`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter === 'all' ? 'All Portals (24)' : filter === 'it' ? 'IT & Hardware' : filter === 'hr' ? 'People & HR' : filter === 'facilities' ? 'Facilities & Workplace' : filter === 'finance' ? 'Finance & Cards' : 'Legal & Compliance'}
            </button>
          ))}
        </div>

        <div className="search-input surface-soft">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Quick find service template..."
          />
        </div>
      </div>

      <div className="catalog-grid">
        {visibleCatalog.map((card) => (
          <div
            key={card.id}
            className={`catalog-card accent-${card.accent}`}
            onClick={() => showToast(`Opened ${card.name} Form`)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                showToast(`Opened ${card.name} Form`)
              }
            }}
          >
            <div className="catalog-head">
              <div className="catalog-icon">
                <span className="material-symbols-outlined">{card.icon}</span>
              </div>
              <span className="mini-badge neutral">{card.badge}</span>
            </div>
            <h3>{card.name}</h3>
            <p>{card.description}</p>
            <div className="catalog-meta">
              <span><span className="material-symbols-outlined tiny">schedule</span> 2-4 days</span>
              <span className="tag">{card.category.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
