This document records one narrow, user-facing Service Request flow implemented
with a React frontend, a NestJS backend, and SQLite persistence through Prisma.

## Flow Delivered

The requester opens the React **Submit request** view, selects the supported `new-laptop` request type, enters a description, and submits the form. The frontend sends an explicit JSON request to the NestJS Intake API. The backend validates the actor, request type, form data, and description, then attaches the actor's directory department before it persists a `Request`, its initial `StatusEvent`, and any attachment metadata in SQLite.

The Routing queue is the second frontend section. It reads live pending items from `GET /routing-decisions/queue`, including requests submitted through the Intake form. Approving or rejecting an item calls the Routing API, which updates the same persisted Request and appends a status event. The top-bar avatar lets the demo user switch between `employee-1`, `employee-2`, `manager-1`, and `manager-2` without changing the page.

## Contract

### Request

```http
POST /requests
Content-Type: application/json
x-actor-id: employee-1
```

```json
{
	"requesterId": "employee-1",
	"requestTypeId": "new-laptop",
	"description": "My laptop cannot run the required development tools.",
	"formData": {},
	"idempotencyKey": "request-001"
}
```

### Response

```json
{
	"request": {
		"id": "REQ-...",
		"requesterId": "employee-1",
		"requestTypeId": "new-laptop",
		"description": "My laptop cannot run the required development tools.",
		"formData": { "department": "IT" },
		"status": "Pending Approval",
		"createdAt": "2026-09-14T...Z",
		"attachments": [],
		"statusEvents": [
			{
				"status": "Submitted",
				"source": "intake",
				"createdAt": "2026-09-14T...Z"
			},
			{
				"status": "Pending Approval",
				"source": "routing",
				"createdAt": "2026-09-14T...Z"
			}
		]
	},
	"replayed": false
}
```

Request types are available from:

```http
GET /request-types
```

The current supported type is `new-laptop`, which has no user-entered department field. The backend attaches the authenticated actor's department from the mock directory. The backend also seeds `pto-request` and `desk-relocation` for future slices; their user-entered fields are dates and destination respectively.

The live approval queue is available from:

```http
GET /routing-decisions/queue

x-actor-id: manager-1
```

Each submitted request creates a one-step approval decision for its designated manager. The current hierarchy is:

```text
employee-1 -> manager-1
employee-2 -> manager-2
```

The selected avatar user is sent as `x-actor-id` for submissions, queue reads, and decisions. Only the designated manager can approve or reject a routing step.

The existing decision endpoint processes it:

```http
POST /routing-decisions/:decisionId/steps/:stepId/decision
```

## Required Proof Points

### Authorization

The backend treats `x-actor-id` as the authenticated actor placeholder for this local slice. A request is allowed when it matches `requesterId`:

```text
x-actor-id: employee-1
requesterId: employee-1 -> allowed
```

A mismatch is denied with `403 Forbidden`:

```text
x-actor-id: employee-2
requesterId: employee-1 -> denied
```

Real authentication and SSO are intentionally out of scope.

### Deliberately Invalid Request

A description shorter than 10 characters is rejected with `400 Bad Request`.
Missing required fields from the selected request type are also rejected.

### Expected Failure Handling

The frontend handles an unavailable Intake API by showing an actionable error message instead of clearing the form. The backend handles duplicate submission retries through `idempotencyKey`: a retry returns the original request with `replayed: true` and does not create a second database row.

## Persistence

Prisma models:

- `Request`: the submitted request and current status.
- `RequestType`: seeded form schema metadata.
- `Attachment`: metadata only; file bytes are not stored here.
- `StatusEvent`: append-only initial status history.

The local database is `backend/prisma/dev.db` and is ignored by Git.

## Verification Evidence

### Automated business-rule test

`src/intake/intake.service.spec.ts` verifies that an actor mismatch throws `ForbiddenException`, and that a short description throws `BadRequestException`.

### Backend/database integration test

The same suite submits an authorized request through `IntakeService`, reads it back from SQLite with Prisma, and verifies its attachment metadata and initial `Submitted` status event.

### HTTP end-to-end test

`test/app.e2e-spec.ts` sends `POST /requests`, reads the new request from the live Routing queue, approves it, and reads SQLite to verify the persisted `Approved` status and status event.

### Regression protection

The existing routing approval tests remain in the suite. The full verification run passed:

```text
npm test       3 files, 11 tests passed
npm run test:e2e  1 file, 7 tests passed
npm run build
npm run lint
```

Frontend verification also passed:

```text
npm run build
npm run lint
```

## Known Scope Boundaries

- No production authentication; `x-actor-id` is a local authorization seam.
- No real file upload; only attachment metadata is accepted by the API.
- No event bus; the request-created event is represented by the persisted initial status event for this slice.
- Routing decisions remain an in-memory projection; pending requests are rebuilt from SQLite on backend startup.
- No deployment, CI/CD, monitoring, external integrations, runtime AI, RAG, or MCP.
