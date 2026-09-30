# Internal Operations Service Hub

A request-management service for HR and IT operations. A requester submits a
request through a React UI; NestJS validates it, persists it in PostgreSQL via
Prisma, and routes it to the approver queue. Approval updates the same persisted
request and appends a status event, and the request then moves to a fulfilment
queue where it is resolved and closed.

```text
backend/   NestJS API, Prisma schema, PostgreSQL persistence, tests
frontend/  React + Vite operational UI
docs/      Specification, architecture, and one evidence file per week
```

## Live App

> **[PENDING]** the deployed URL, filled in once the release target is
> provisioned. Everything else here is verifiable against the production
> container image today.

The app is served from a single origin — the API serves the built frontend when
`STATIC_DIR` is set — so there is one URL and no CORS configuration. A cold open
with no local setup should load the app and allow the journey below.

**Demo access.** Click the avatar in the top bar to switch identity between four
seeded actors. Requests route by the employee's manager:

| Actor | Role | Routes to |
|---|---|---|
| `employee-1` | Requester | `manager-1` |
| `employee-2` | Requester | `manager-2` |
| `manager-1` | Manager, IT queue | — |
| `manager-2` | Manager, HR queue | — |

`admin-1` is also seeded for configuration and reports, and `fulfiller-it-1` for
the fulfilment queue. The UI offers the first four; the rest are reachable via
the API with the `x-actor-id` header.

**One critical journey.** Submit → approve → fulfil → close. `scripts/smoke.sh`
runs exactly this against any target and exits non-zero on failure, so it is the
authoritative version:

```bash
BASE_URL=<url> ./scripts/smoke.sh
```

By hand, in the UI:

1. **Submit.** Open **Submit request**, pick a type, write a description of at
   least 10 characters, and submit. The persisted request ID and
   `Pending Approval` status are displayed.
2. **Approve.** Switch to `manager-1`, open **Routing queue**, find the request,
   and approve it. The step becomes `Approved` and the decision `ReadyForQueue`.
   A rejection requires a reason, which the requester can then see.
3. **Fulfil.** As `fulfiller-it-1`, resolve the request from the fulfilment
   queue, then close it. The request reaches `Closed`.
4. **Audit.** Open the request's audit view to see the full status history and,
   for a rejected request, the rejection reason.

Optionally, use **Fill form with AI** in the request creator to get suggested
type and form values. Suggestions never submit anything; required fields still
need completing.

The same journey over HTTP, for the seeded approval:

```bash
curl -X POST <url>/routing-decisions/seed-routing-001/steps/seed-approval-001/decision \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: manager-1' \
  -d '{"decision":"approve"}'
```

## Engineer Quick Start

**Prerequisites** — Node.js 20+ and npm. The backend also needs a PostgreSQL
instance; the quickest is the container below, which requires Docker.

**Install and configure the database:**

```bash
docker run -d --name iosh-pg -e POSTGRES_PASSWORD=iosh -e POSTGRES_USER=iosh \
  -e POSTGRES_DB=iosh -p 5433:5432 postgres:17-alpine
cd backend && npm install
```

`backend/.env` points at that database:

```text
DATABASE_URL="postgresql://iosh:iosh@localhost:5433/iosh"
```

Copy `backend/.env.example` if you need a starting point. It documents every
variable. `GEMINI_API_KEY` is optional — without it, AI assistance falls back to
the deterministic local provider, which is what lets the AI evaluation run with
no credentials at all.

**Create the schema and demo data:**

```bash
cd backend && npm run release:prepare   # prisma db push && prisma db seed
```

**Install and run the frontend:**

```bash
cd frontend && npm install
```

Then run the two applications in separate terminals:

```bash
cd backend  && npm run start:dev   # API on http://localhost:3000
cd frontend && npm run dev         # UI  on http://localhost:5173
```

**Verify.** Tests require a reachable database — there is no embedded fallback.
Unit and e2e share one database, so they run serially by design; do not
re-enable parallel test files.

```bash
cd backend
npm test          # 120 unit tests
npm run test:e2e   # 14 e2e tests over the HTTP contract
npm run eval:ai    # 9 deterministic AI cases, no API key needed
npm run lint
npm run build      # also the typecheck: vitest does not typecheck

cd ../frontend
npm run lint
npm run build
```

The same checks run on every push to `main` through GitHub Actions
(`.github/workflows/ci.yml`), against a PostgreSQL service container, so a fresh
clone can verify the project without reproducing any of the local setup.

## Operations

**Health and readiness.** Two unauthenticated endpoints; neither exposes
configuration, data, or a connection string.

| Endpoint | Meaning |
|---|---|
| `GET /health` | Liveness — the process is up |
| `GET /health/ready` | Readiness — the database is reachable; 503 when it is not |

```bash
curl <url>/health
curl <url>/health/ready
```

A platform health check should point at `/health/ready`, since it is the one
that reflects a real dependency failure. This deployment points at `/health`
deliberately, so a transient database fault does not trigger a restart loop.

**Logs and monitoring.** Every request emits one structured JSON line to stdout:

```json
{"timestamp":"2026-09-29T20:47:27.207Z","level":"info","event":"http.request.completed","requestId":"164fb601-...","method":"GET","path":"/requests/mine","statusCode":200,"durationMs":3,"actorId":"employee-1"}
```

Each line carries a `requestId` that is also returned in the `x-request-id`
response header, so a single request can be traced end to end. A
caller-supplied `x-request-id` is preserved rather than replaced, letting a
client correlate its own identifier with the server log. Failures log at `warn`
or `error` and include the exception name and message.

**Configuration ownership.** `backend/.env.example` is the reference and is the
only configuration file in the repository — `backend/.env` is gitignored and no
API key is required for any check to run. Configuration is validated once at
startup: a missing `DATABASE_URL`, an unrecognised `AI_PROVIDER`, or a malformed
`FRONTEND_ORIGIN` fails the boot and names every problem, rather than failing
later on a single request.

**Controlled failure and recovery.** Stopping the database makes readiness go
red while liveness stays green; restoring it makes both healthy again, with no
application restart and no data loss:

```json
{"status":"not_ready","checks":{"database":{"status":"error","error":"database_unreachable"}}}
```

**Post-recovery verification.** The journey must be re-run after recovery, not
assumed. `scripts/smoke.sh` is that check — it walks submit → approve → fulfil →
close and asserts the authorization boundary, so a pass after recovery is
evidence the service is genuinely usable rather than merely answering requests.

The full failure and recovery transcript, with observed output, is in
[Week 5 release operations](docs/week5-release-operations.md).

**Deployment.** A single service, built by `Dockerfile` in three stages and
configured by `railway.json`, which also runs the schema and seed commands at
deploy time. Seeding is idempotent — `upsert` only, never `deleteMany` — so it
is safe on every deploy and will not destroy in-flight demo state. Without it
the app would boot healthy and present an empty shell with no request types and
no roles.

## Evidence Map

Direct links to the proof, in the order the work was delivered. No hunting.

**Week 1 — design.** Specification and the decisions it rests on, written before
any code:

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [ADR-001](docs/decisions/ADR-001.md)

**Weeks 2–5 — delivery.** One file per week. These are point-in-time records of
what each week actually delivered and are intentionally not rewritten
afterwards:

- [Week 2 — routing evidence](docs/week2-agentic-workflow.md)
- [Week 3 — full-stack delivery](docs/week3-full-stack-delivery.md)
- [Week 4 — production AI](docs/week4-production-ai.md)
- [Week 5 — release operations](docs/week5-release-operations.md)

Week 5 carries the release SHA, the release-gate result, the smoke-test output,
the failure and recovery transcript, and the known gaps between the
specification and what was built.

## API Reference

The HTTP contract, for working against the API directly. The approver is always
derived from the `x-actor-id` header, never from a query parameter or the body.

**List seeded request types:**

```bash
curl <url>/request-types
```

**Submit an authorized request:**

```bash
curl -X POST <url>/requests \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: employee-1' \
  -d '{
    "requesterId": "employee-1",
    "requestTypeId": "new-laptop",
    "description": "My laptop cannot run the required development tools.",
    "formData": {},
    "idempotencyKey": "request-001"
  }'
```

The backend attaches the authenticated actor's directory department to
`formData`. The response carries a generated request ID, `status: "Pending
Approval"`, and both the initial `Submitted` event and the Routing handoff event.

**List the live approval queue:**

```bash
curl <url>/routing-decisions/queue -H 'x-actor-id: manager-1'
```

**Decide a step**, using the `decisionId` and `stepId` from the queue response or
from any request audit:

```bash
curl -X POST <url>/routing-decisions/{decisionId}/steps/{stepId}/decision \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: manager-1' \
  -d '{"decision":"approve"}'
```

Only the designated manager may decide a step.

**Behaviours worth knowing:**

| Condition | Result |
|---|---|
| Actor is not the requester | `403 Forbidden` |
| Actor is unknown to the directory | `401 Unauthorized` |
| Description shorter than 10 characters | `400 Bad Request` |
| Reused `idempotencyKey` | The original request, with `replayed: true` |
| Rejection without a reason | `400 Bad Request` |
| Deciding an already-decided step | `409 Conflict` |

Routing decisions and approval steps are persisted in PostgreSQL, and the queue
is read from the database rather than held in memory.
