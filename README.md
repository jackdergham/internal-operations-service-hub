# Internal Operations Service Hub

A small internal request-management service for HR and IT operations. The
current full-stack slice lets a requester submit a service request through a
React UI, validates it in NestJS, persists it in SQLite through Prisma, and
hands it to the live Routing queue for approval. Approval updates the same
persisted request and appends a status event.

## Project structure

```text
backend/   NestJS API, Prisma schema, SQLite persistence, tests
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

`backend/.env` contains the local SQLite configuration:

```text
DATABASE_URL="file:./dev.db"
```

The SQLite database is created at `backend/prisma/dev.db` and is ignored by
Git.

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

Open the frontend and use the **Submit request** section. The form sends a
real request to `POST /requests` and displays the persisted request ID and
`Pending Approval` status. Switch to **Routing queue** to see the newly
submitted request and approve or reject it through the NestJS routing endpoint.
Click the avatar in the top bar to switch between `employee-1`, `employee-2`,
`manager-1`, and `manager-2`. Requests from `employee-1` route only to
`manager-1`, while requests from `employee-2` route only to `manager-2`.

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
    "formData": { "department": "Engineering" },
    "idempotencyKey": "request-001"
  }'
```

The response contains a generated request ID, `status: "Pending Approval"`,
and both the initial `Submitted` event and the Routing handoff event.

List the live approval queue:

```bash
curl 'http://localhost:3000/routing-decisions/queue?approverId=manager-1'
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
  -d '{"approverId":"manager-1","decision":"approve"}'
```

The persisted request moves from `Pending Approval` to `Approved` and receives
an `Approved` status event.

An actor mismatch is intentionally denied:

```bash
curl -i -X POST http://localhost:3000/requests \
  -H 'Content-Type: application/json' \
  -H 'x-actor-id: employee-2' \
  -d '{
    "requesterId": "employee-1",
    "requestTypeId": "new-laptop",
    "description": "This request is submitted for another employee.",
    "formData": { "department": "Engineering" }
  }'
```

This returns `403 Forbidden`. A description shorter than 10 characters returns
`400 Bad Request`. Reusing the same `idempotencyKey` returns the original
request with `replayed: true` instead of creating a duplicate.

## Existing routing API

The seeded approval is available at:

```bash
curl -X POST http://localhost:3000/routing-decisions/decision-1/steps/step-1/decision \
  -H 'Content-Type: application/json' \
  -d '{"approverId":"manager-1","decision":"approve"}'
```

This changes the seeded approval step to `Approved` and its routing decision to
`ReadyForQueue`. Pending persisted requests are rebuilt into the routing
projection when the backend restarts.

## Automated verification

Backend checks:

```bash
cd backend
npm test
npm run test:e2e
npm run build
npm run lint
```

Frontend checks:

```bash
cd frontend
npm run build
npm run lint
```

The backend tests cover the request business rules, SQLite persistence, HTTP
contract, authorization denial, invalid input, idempotent retry handling, and
the employee-to-manager routing hierarchy.

## Documentation

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Week 2 routing evidence](docs/week2-agentic-workflow.md)
- [Week 3 full-stack delivery](docs/week3-full-stack-delivery.md)
