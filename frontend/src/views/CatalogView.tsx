type Props = {
  onInitiateRequest: () => void
}

export default function CatalogView({ onInitiateRequest }: Props) {
  return (
    <div className="page-banner">
      <div>
        <div className="eyebrow-label">SERVICES &amp; REQUESTS</div>
        <h1>What do you need help with?</h1>
      </div>
      <div className="banner-actions">
        <button type="button" className="primary-action" onClick={onInitiateRequest}>
          <span className="material-symbols-outlined">add</span>
          <span>Initiate Request</span>
        </button>
        <button type="button" className="secondary-action">
          <span className="material-symbols-outlined">auto_awesome</span>
          <span>AI-Assisted Request</span>
        </button>
      </div>
    </div>
  )
}
