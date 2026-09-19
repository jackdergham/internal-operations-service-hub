import { myRequestRows } from '../data'

export default function MyRequestsView() {
  return (
    <>
      <div className="tracker-panel">
        <div className="panel-header tracker-header">
          <div>
            <div className="eyebrow-label">TICKET TRACKER</div>
            <h2>Active Request Pipeline: OpsHub Request Lifecycle</h2>
          </div>
          <span className="mini-badge info">Step 3 of 5 In Progress</span>
        </div>

        <div className="step-grid">
          {[
            { label: 'Submitted', meta: 'Oct 24, 09:15', active: false },
            { label: 'Manager Approved', meta: 'Oct 24, 11:30', active: false },
            { label: 'In Fulfillment', meta: 'Dave Miller (IT)', active: true },
            { label: 'Dispatched', meta: 'Pending Prep', active: false },
            { label: 'Delivered', meta: 'Awaiting closeout', active: false },
          ].map((step, index) => (
            <div key={step.label} className={`step-item ${step.active ? 'current' : ''} ${index > 2 ? 'light' : ''}`}>
              <div className="step-bullet" />
              <strong>{step.label}</strong>
              <span>{step.meta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="table-panel">
        <div className="table-header">
          <h3>Submissions History &amp; Status</h3>
          <span>4 Records Found</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Service</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {myRequestRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="request-cell">
                    <strong>{row.title}</strong>
                    <span>{row.id}</span>
                  </div>
                </td>
                <td>{row.service}</td>
                <td>{row.owner}</td>
                <td>
                  <span className={`state-badge ${row.state.toLowerCase()}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
