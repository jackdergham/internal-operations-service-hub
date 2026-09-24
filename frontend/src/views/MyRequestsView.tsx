import { myRequestRows } from '../data'

export default function MyRequestsView() {
  const requestDetails = [
    { submitted: 'Today, 09:15', stage: 'In Progress', sla: '28 hrs remaining', action: 'View Trail', icon: 'schedule', tone: 'active' },
    { submitted: 'Yesterday, 14:20', stage: 'Pending Approval', sla: '14 hrs remaining', action: 'View Trail', icon: 'pending', tone: 'pending' },
    { submitted: 'Oct 18, 10:00', stage: 'Resolved', sla: 'Fulfilled in 6 hrs', action: 'Audit Closed', icon: 'check_circle', tone: 'resolved' },
    { submitted: 'Oct 12, 16:45', stage: 'Resolved', sla: 'Completed', action: 'Receipt File', icon: 'check_circle', tone: 'resolved' },
  ]

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
            { label: 'Submitted', meta: 'Oct 24, 09:15', icon: 'check', complete: true },
            { label: 'Manager Approved', meta: 'Oct 24, 11:30', icon: 'check', complete: true },
            { label: 'In Fulfillment', meta: 'Dave Miller (IT)', icon: 'sync', active: true },
            { label: 'Dispatched', meta: 'Pending Prep', icon: '4', future: true },
            { label: 'Delivered', meta: 'Awaiting closeout', icon: '5', future: true },
          ].map((step) => (
            <div key={step.label} className={`step-item ${step.complete ? 'complete' : ''} ${step.active ? 'current' : ''} ${step.future ? 'light' : ''}`}>
              <div className={`step-bullet ${step.complete ? 'complete' : ''} ${step.active ? 'active' : ''}`}>
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
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

        <div className="request-table-scroll">
          <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Title &amp; Classification</th>
              <th>Submitted</th>
              <th>Current Stage</th>
              <th>SLA Target</th>
              <th className="request-action-heading">Action</th>
            </tr>
          </thead>
          <tbody>
            {myRequestRows.map((row, index) => {
              const details = requestDetails[index]

              return (
              <tr key={row.id}>
                <td className="request-id-cell">#{row.id}</td>
                <td>
                  <div className="request-cell">
                    <strong>{row.title}</strong>
                    <span>{row.service}</span>
                  </div>
                </td>
                <td className="request-muted-cell">{details.submitted}</td>
                <td>
                  <span className={`request-stage ${details.tone}`}>
                    <span className="material-symbols-outlined">{details.icon}</span>
                    {details.stage}
                  </span>
                </td>
                <td className={`request-sla ${details.tone}`}>{details.sla}</td>
                <td className="request-action-cell"><span className="request-action">{details.action}</span></td>
              </tr>
              )
            })}
          </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
