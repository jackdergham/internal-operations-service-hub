# Internal Operations Service Hub

An internal request-management service for HR and IT operations. The planned
system will give employees one place to submit requests, track progress, and
receive decisions, while giving departments clear queues, approval workflows,
and an audit trail.

The backend is built with NestJS. The currently implemented slice is an
in-memory routing and approval endpoint. It allows the designated approver to
approve or reject a pending approval step and enforces the core approval rules.

## Current implementation

The backend currently contains one seeded routing decision:

- Routing decision: `decision-1`
- Approval step: `step-1`
- Designated approver: `manager-1`
- Destination queue: `it-support`

The endpoint is:

```text
POST /routing-decisions/:decisionId/steps/:stepId/decision
```

Approve a request:

```json
{
	"approverId": "manager-1",
	"decision": "approve"
}
```

Reject a request:

```json
{
	"approverId": "manager-1",
	"decision": "reject",
	"reason": "Budget is not available"
}
```

The data is currently stored in memory and resets when the server restarts.
Authentication, persistence, notifications, org-chart integration, and
multi-step approval resolution are not implemented yet.

## Run the backend

From the repository root:

```bash
cd backend
npm install
npm run start:dev
```

The server runs on `http://localhost:3000` by default.

## Try the endpoint

With the server running, approve the seeded step:

```bash
curl -X POST http://localhost:3000/routing-decisions/decision-1/steps/step-1/decision \
	-H 'Content-Type: application/json' \
	-d '{"approverId":"manager-1","decision":"approve"}'
```

A successful response changes the approval step to `Approved` and the routing
decision to `ReadyForQueue`.

To test rejection, restart the server first so the in-memory data is reset:

```bash
curl -X POST http://localhost:3000/routing-decisions/decision-1/steps/step-1/decision \
	-H 'Content-Type: application/json' \
	-d '{"approverId":"manager-1","decision":"reject","reason":"Budget is not available"}'
```

## Verify the backend

Run these commands from `backend/`:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
```

The tests cover successful approval and rejection, wrong-approver protection,
required rejection reasons, missing records, and duplicate decisions.

Project design notes are available in [`docs/`](docs/), including the
[product specification](docs/product-spec.md),
[architecture](docs/architecture.md), [data model](docs/data-model.md), and
[workflow evidence](docs/week2-agentic-workflow.md).