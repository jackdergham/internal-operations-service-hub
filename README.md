# Internal Operations Service Hub

A small internal request-management service for HR and IT operations. The current full-stack slice lets a requester submit a service request through a React UI, validates it in NestJS, persists it in PostgreSQL through Prisma, and hands it to the live Routing queue for approval. Approval updates the same persisted request and appends a status event.

## Project structure

```text
backend/   NestJS API, Prisma schema, PostgreSQL persistence, tests
frontend/  React + Vite operational UI
docs/      Product, architecture, data model, and delivery evidence
```

## Prerequisites

- Node.js 20 or newer
- npm

## Install

Install each application separately:

```bash
cd backend
npm install
npm run db:generate
npm run db:push

cd ../frontend
npm install
```

`backend/.env` contains the local PostgreSQL connection string. Start the database first, then create the schema and demo data:

```bash
docker run -d --name iosh-pg -e POSTGRES_PASSWORD=iosh -e POSTGRES_USER=iosh \
  -e POSTGRES_DB=iosh -p 5433:5432 postgres:17-alpine
cd backend && npm run release:prepare   # prisma db push && prisma db seed
```

```text
DATABASE_URL="postgresql://iosh:iosh@localhost:5433/iosh"
```

For optional Gemini assistance, add the following backend variables. Never commit the API key:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=<your-rotated-key>
GEMINI_MODEL=<supported-gemini-model>
```

When `AI_PROVIDER` is not `gemini`, or the key is unavailable, the backend uses the deterministic local assistance provider instead.

The schema targets PostgreSQL in local development, in CI, and in deployment alike, so the tests and the live app run on the same database engine.

## Run the applications

Use two terminals.

Terminal 1, backend:

```bash
cd backend
npm run start:dev
```

The API runs at `http://localhost:3000`.

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

The UI runs at `http://localhost:5173`.

Open the frontend and use the **Submit request** section. The form sends a real request to `POST /requests` and displays the persisted request ID and `Pending Approval` status. Switch to **Routing queue** to see the newly submitted request and approve or reject it through the NestJS routing endpoint. Click the avatar in the top bar to switch between `employee-1`, `employee-2`, `manager-1`, and `manager-2`. Requests from `employee-1` route only to `manager-1`, while requests from `employee-2` route only to `manager-2`.

Inside the same request creator, enter a description and select **Fill form with AI** to receive suggested request type and form values. Review the suggestions and complete any missing required fields before submitting. AI assistance does not submit requests automatically.

## Service Request API

List seeded request types:

```bash
curl http://localhost:3000/request-types
```

Submit an authorized request:

```bash
curl -X POST http://localhost:3000/requests \
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

The backend attaches the authenticated actor's directory department to `formData`; the response contains a generated request ID, `status: "Pending Approval"`, and both the initial `Submitted` event and the Routing handoff event.

List the live approval queue. The approver is taken from the `x-actor-id` header, not a query parameter:

```bash
curl http://localhost:3000/routing-decisions/queue \
  -H 'x-actor-id: manager-1'
```

The matching employee-to-manager hierarchy is:

```text
employee-1 -> manager-1
employee-2 -> manager-2
```

Only the designated manager can approve or reject a routing step.

Use the returned `decisionId` and `stepId` to process a request:

```bash
curl -X POST http://localhost:3000/routing-decisions/{decisionId}/steps/{stepId}/decision \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: manager-1' \
  -d '{"decision":"approve"}'
```

The approver is derived from the `x-actor-id` header, so the body carries only the decision.

The persisted request moves from `Pending Approval` to `Approved` and receives an `Approved` status event.

An actor mismatch is intentionally denied:

```bash
curl -i -X POST http://localhost:3000/requests \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: employee-2' \
  -d '{
    "requesterId": "employee-1",
    "requestTypeId": "new-laptop",
    "description": "This request is submitted for another employee.",
    "formData": {}
  }'
```

This returns `403 Forbidden`. A description shorter than 10 characters returns `400 Bad Request`. Reusing the same `idempotencyKey` returns the original request with `replayed: true` instead of creating a duplicate.

## Existing routing API

The seeded approval is available at:

```bash
curl -X POST http://localhost:3000/routing-decisions/seed-routing-001/steps/seed-approval-001/decision \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: manager-1' \
  -d '{"decision":"approve"}'
```

These are the IDs created by `npm run db:seed`. This changes the seeded approval step to `Approved` and its routing decision to `ReadyForQueue`. Routing decisions and approval steps are persisted in PostgreSQL, and the queue is read from the database rather than held in memory.

## Automated verification

Backend checks:

```bash
cd backend
npm test
npm run test:e2e
npm run build
npm run lint
npm run eval:ai
```

`npm run eval:ai` runs the nine deterministic request-assistance cases without requiring a Gemini API key or network access.

Frontend checks:

```bash
cd frontend
npm run build
npm run lint
```

The backend tests cover the request business rules, PostgreSQL persistence, HTTP contract, authorization denial, invalid input, idempotent retry handling, and the employee-to-manager routing hierarchy.

## Engineer quick start

Requires Node.js 20+ and npm. The backend additionally needs a PostgreSQL
instance; the quickest way to get one locally is the container below.

```bash
docker run -d --name iosh-pg -e POSTGRES_PASSWORD=iosh -e POSTGRES_USER=iosh \
  -e POSTGRES_DB=iosh -p 5433:5432 postgres:17-alpine
cd backend && npm install && npm run release:prepare
cd ../frontend && npm install
```

`npm run release:prepare` runs `prisma db push` and `prisma db seed`, creating
the schema and the demo roles and requests the UI expects.

Then run the two applications in separate terminals — `npm run start:dev` in
`backend/`, `npm run dev` in `frontend/` — and open `http://localhost:5173`.
`Install` above covers the same steps in more detail.

The same checks run on every push through GitHub Actions (`.github/workflows/ci.yml`),
including a PostgreSQL service container, so a fresh clone can verify the project
without reproducing the local setup.

## Operations

**Health.** Two unauthenticated endpoints, both safe to expose to a platform
health check because neither reveals configuration or data:

```bash
curl http://localhost:3000/health         # liveness: the process is up
curl http://localhost:3000/health/ready   # readiness: the database is reachable
```

`/health/ready` returns `503 Service Unavailable` with a per-check breakdown when
the database is unreachable, which is what makes a real failure observable rather
than inferred. A platform health check should point at `/health/ready`.

**Logs.** Every request emits one structured JSON line to stdout:

```json
{"timestamp":"2026-09-29T20:47:27.207Z","level":"info","event":"http.request.completed","requestId":"164fb601-...","method":"GET","path":"/requests/mine","statusCode":200,"durationMs":3,"actorId":"employee-1"}
```

Each line carries a `requestId` that is also returned in the `x-request-id`
response header, so a specific request can be traced end to end. Failed requests
log at `warn` or `error` and include the exception name and message. A
`requestId` supplied by a caller is preserved rather than replaced, which lets a
client correlate its own identifier with the server log.

**Configuration.** `backend/.env.example` documents every variable. Configuration
is validated once at startup: a missing `DATABASE_URL`, an unrecognised
`AI_PROVIDER`, or a malformed `FRONTEND_ORIGIN` fails the boot with a message
naming every problem, rather than failing later on a single request.

**Single deployment.** Setting `STATIC_DIR` makes the API serve the built
frontend, so the app and API share one origin and no CORS configuration is
needed. It is unset locally, where Vite serves the UI on its own port.

**Recovery.** The failure and recovery run against the deployed target —
readiness going red when the database is stopped, then green once it is restored,
with the critical journey re-run afterwards — is recorded in
[Week 5 release operations](docs/week5-release-operations.md).

## Documentation

Design and specification, current as of the latest delivery:

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [ADR-001](docs/decisions/ADR-001.md)

Delivery evidence, one file per week. These are point-in-time records of what
each week actually delivered and are intentionally not rewritten afterwards:

- [Week 2 routing evidence](docs/week2-agentic-workflow.md)
- [Week 3 full-stack delivery](docs/week3-full-stack-delivery.md)
- [Week 4 production AI](docs/week4-production-ai.md)
- [Week 5 release operations](docs/week5-release-operations.md)

Known gaps between the specification and the implementation are catalogued in
[docs/v2-plans.md](docs/v2-plans.md).
