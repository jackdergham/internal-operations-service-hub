What was released, how it is built and gated, how it is operated, and what
remains unproven.

**Live target:** <https://internal-operations-service-hub-production-8a07.up.railway.app/>

## Release identification

| | |
|---|---|
| Repository | `jackdergham/internal-operations-service-hub` |
| Release branch | `main` |
| Release SHA | `3ae3f59` — *Create the database schema on boot in production* |
| Release gate | GitHub Actions, green on the release SHA |
| Deployed target | Single Railway service, one origin, one URL |
| Database | PostgreSQL 17 — same engine locally, in CI, and deployed |
| Verification | Smoke test 13/13 on the live target, before and after a controlled failure |

`main` was fast-forwarded to the feature branch, so the released commit is the
same commit that was reviewed and tested, with no intervening merge commit.

The three areas named in the release-ownership brief — required checks, health
and operations evidence, and real recovery — are evidenced below against the
deployed target rather than described.

### The submitted commit differs from the deployed commit by documentation only

The commit submitted for review comes after `3ae3f59` and changes only
documentation: this file and the README's *Live App* section. It is the
deployment evidence that had to be written **after** the target existed, since it
records the live URL, the observed smoke output, and the failure and recovery
transcript.

**No source file, test, or configuration differs between the deployed commit and
the submitted commit.** The running application is byte-for-byte the application
in the submitted repository, so everything evidenced below — the 13-check smoke
run, the health and readiness behaviour, and the failure and recovery cycle —
remains true of the submitted commit.

This is deliberate rather than incidental. The alternative would be to record
live evidence in a commit that predates the deployment, which can only be done
by predicting the outcome instead of observing it.

## What is deployed

A single service: one deployment, one origin, one URL. The API serves the built
frontend when `STATIC_DIR` is set, so the app and the API share an origin and no
CORS configuration is needed.

`main.ts` registers the static handler with `fallthrough: true`, so a path that
does not match an asset falls through to the Nest router — API routes are never
shadowed by the asset handler.

### Build

`Dockerfile` is a three-stage build: frontend bundle, backend compile, then a
runtime image holding only compiled output plus dependencies. The frontend
`dist` is copied to `/app/public`, and `STATIC_DIR=/app/public` is baked in.

`VITE_API_BASE_URL` is deliberately unset: in a production build an unset value
means "same origin", so the app calls the origin it was served from rather than
a hardcoded host.

### Schema creation happens in the application

The application runs `prisma db push` before Nest initialises, in the same
process that resolves the same `DATABASE_URL` as the code querying it
(`src/ops/schema-bootstrap.ts`). It is gated on `NODE_ENV=production`, which the
runtime image already sets, so no platform configuration is involved.

This replaced a schema push configured as a platform deploy hook. That hook was
not applied on the deployed service: the container ran the image's default
command, the schema was never created, and the application crashed in
`RoutingService.onModuleInit` with `P2021 — table public.Request does not exist`.
Moving the work into the application removed the dependency on a platform
honouring its configuration, and the deployed service now comes up from an empty
database without intervention.

The seed runs only when the database has no request types, so a first boot
populates the demo data while later restarts preserve existing state. Verified:
a second boot logs `schema.seed.skipped` with `database already populated`, and a
request created before a restart is still present afterwards.

### Configuration

| Variable | Deployed value | Notes |
|---|---|---|
| `DATABASE_URL` | Railway Postgres connection string | Injected by the platform. Required — the boot fails with a named error if absent. |
| `STATIC_DIR` | `/app/public` | Baked into the image. Serves the frontend. |
| `PORT` | Injected by the platform | Defaults to 3000 otherwise. |
| `AI_PROVIDER` | `gemini` | Real model on the deployed target, with automatic fallback to the deterministic provider. |
| `GEMINI_API_KEY` | Railway secret | Never in the repository. The test gate runs without it. |
| `FRONTEND_ORIGIN` | unset | Same-origin deployment needs no CORS allow-list. |

Configuration is validated once at startup. A missing `DATABASE_URL`, an
unrecognised `AI_PROVIDER`, or a malformed `FRONTEND_ORIGIN` fails the boot and
names every problem, rather than failing later on a single request.

No secrets are committed: `backend/.env` is gitignored, the repository carries
only `backend/.env.example`, and no check in the release gate needs an API key.

## Release gate

`.github/workflows/ci.yml` runs on every push to `main` and every pull request
targeting it. The backend job is sequential against a PostgreSQL service
container:

```
db:generate → db:push → lint → build → test → test:e2e → eval:ai
```

- The **service container** is required — a bare runner has no database, so
  `db:push` and the tests would fail immediately. Its `--health-cmd` prevents a
  race where the job starts before PostgreSQL accepts connections.
- **Unit and e2e stay in one sequential job.** They share a database, and
  `vitest.config.ts` sets `fileParallelism: false` for that reason. Parallel jobs
  would have them wipe each other's data.
- **The build step is the type gate.** vitest transpiles without typechecking,
  so `tsc` is the only thing catching type errors.
- **`AI_PROVIDER: local`, no secret.** Anyone who clones the repository can run
  the gate, which is the same reproducibility property Week 4 claims.

The frontend job runs in parallel and needs no database.

**Observed on `3afeba9`:** 120 unit, 14 e2e, 9 AI evaluation — 143 passing. The
sequence was also verified against a genuinely empty database, not only a warm
one, to confirm it works from a clean checkout.

## Final smoke test

`scripts/smoke.sh` is a repeatable artifact rather than a claim. It takes a
`BASE_URL`, so the same script runs against localhost and the deployed target,
and exits non-zero on any failure.

```
liveness → readiness → frontend served → submit → pending approval
→ appears in approver queue → approve → ReadyForQueue
→ fulfil → close → status Closed → cross-actor submission denied (403)
```

It distinguishes liveness from readiness, so a database outage fails the run
rather than passing as healthy. It also asserts the authorization boundary — the
journey has an employee submitting for themselves, and a cross-actor attempt
must be refused — so a green run shows the boundary holds, not merely that
requests can be created.

**Observed on the live target:**

```
Smoke testing https://internal-operations-service-hub-production-8a07.up.railway.app
PASS  liveness (200)
PASS  liveness reports ok
PASS  readiness (200)
PASS  readiness reports database ok
PASS  frontend served at /
PASS  request submitted (REQ-B48D6152)
PASS  submitted request is pending approval
PASS  request appears in the approver queue
PASS  approval moves decision to ReadyForQueue
PASS  fulfillment resolve (201)
PASS  fulfillment close (201)
PASS  request reached Closed
PASS  cross-actor submission denied (403)

SMOKE PASSED: 13 checks
```

The script is also confirmed to **fail correctly**, which is what makes a pass
meaningful: against an unreachable host it exits 1, and with PostgreSQL stopped
it fails on readiness and on submission. See *Failure and recovery* below.

## Health and monitoring

Two unauthenticated endpoints, neither exposing configuration, data, or a
connection string:

| Endpoint | Meaning |
|---|---|
| `GET /health` | Liveness — the process is up |
| `GET /health/ready` | Readiness — the database is reachable; 503 when it is not |

A platform health check should point at `/health/ready`. This deployment points
at `/health` deliberately, so a transient database fault does not trigger a
restart loop that would make an incident worse.

**Observed, database up:**

```json
{"status":"ready","checks":{"database":{"status":"ok","latencyMs":2}}}
```

**Observed, database stopped:**

```json
{"status":"not_ready","checks":{"database":{"status":"error","error":"database_unreachable"}}}
```

Liveness stayed `200` throughout while readiness went red. That separation is
what makes a dependency failure observable rather than inferred.

### Structured logging

Every request emits one structured JSON line to stdout:

```json
{"timestamp":"2026-09-30T00:08:44.642Z","level":"warn","event":"http.request.failed","requestId":"d3361fc3-...","method":"POST","path":"/requests","statusCode":403,"durationMs":1,"actorId":"employee-2","error":{"name":"ForbiddenException","message":"x-actor-id must identify the requester"}}
```

Each line carries a `requestId` also returned in the `x-request-id` response
header, so an individual request can be traced end to end. A caller-supplied
`x-request-id` is preserved rather than replaced, letting a client correlate its
own identifier with the server log. Failures log at `warn` or `error` and
include the exception name and message.

## Failure and recovery

A controlled failure was executed against the deployed target: the Railway
PostgreSQL service was stopped while the application kept running, then
restored.

**Failure** — `2026-09-30T02:10:42Z`, database stopped:

```
$ curl .../health
{"status":"ok","service":"internal-operations-hub","uptimeSeconds":985}
[200]

$ curl .../health/ready
{"status":"not_ready","checks":{"database":{"status":"error","latencyMs":26,"error":"database_unreachable"}}}
[503]
```

The process stayed up and kept serving liveness while correctly reporting that
it could not reach its dependency. The application genuinely refused to work
rather than merely reporting the problem:

```
GET  /request-types   → 500  {"statusCode":"500","message":"Internal server error"}
POST /requests        → 500  {"statusCode":"500","message":"Internal server error"}
GET  /                → 200  text/html   (frontend still served)
```

And the release gate caught it — the smoke run exited non-zero:

```
FAIL  readiness (expected 200, got 503)
FAIL  readiness reports database ok
FAIL  could not submit a request — {"statusCode":500,"message":"Internal server error"}
3 passed, 3 failed → exit 1
```

**Recovery** — `2026-09-30T02:12:29Z`, database restored:

```
$ curl .../health
{"status":"ok","service":"internal-operations-hub","uptimeSeconds":1092}
[200]

$ curl .../health/ready
{"status":"ready","checks":{"database":{"status":"ok","latencyMs":2}}}
[200]
```

Readiness returned 200 within roughly ten seconds of the database being started.

The critical journey was then re-run to completion against the recovered
instance:

```
Smoke testing https://internal-operations-service-hub-production-8a07.up.railway.app
PASS  liveness (200)
PASS  liveness reports ok
PASS  readiness (200)
PASS  readiness reports database ok
PASS  frontend served at /
PASS  request submitted (REQ-102D2B04)
PASS  submitted request is pending approval
PASS  request appears in the approver queue
PASS  approval moves decision to ReadyForQueue
PASS  fulfillment resolve (201)
PASS  fulfillment close (201)
PASS  request reached Closed
PASS  cross-actor submission denied (403)

SMOKE PASSED: 13 checks
```

**No application restart was required** — `uptimeSeconds` rose continuously from
985 to 1092 across the outage — and **no data was lost**. A request created
before the failure, `REQ-B48D6152`, still carried its complete history
afterwards:

```
status: Closed
history: Submitted -> Pending Approval -> Approved -> In Progress -> Resolved -> Closed
```

Seeded reference data was likewise intact: 3 request types and 9 directory
actors.

## Deployment verification

The image was built and exercised before deployment, so build failures are known
rather than discovered on the platform.

- `docker build` completes; image is ~473 MB.
- The image was started locally against an empty PostgreSQL database and came up
  with the schema created and demo data seeded, then passed the full 13-check
  smoke run. The build therefore does not depend on the deployment succeeding.
- `prisma generate` succeeds on `node:24-alpine`: the engine resolves to
  `libquery_engine-linux-musl-openssl-3.0.x`, which is musl-linked and bundles
  its own OpenSSL. The `openssl` and `libc6-compat` packages in the runtime
  stage are a guard against a future Prisma release dropping that build —
  confirmed belt-and-braces by building and running a control image without them.
- A control build confirmed the in-application bootstrap is load-bearing: without
  it the image starts, reports healthy, and crashes on the first query with
  `P2021`.

**On the live target.** The deployed service was opened cold, with no local
setup, and verified end to end:

| Check | Result |
|---|---|
| `GET /` | 200 `text/html`, `<title>OpsHub</title>` |
| SPA bundle / CSS / favicon | 200, 271 KB / 36 KB, all from the same origin |
| `GET /request-types` | 200, 3 seeded request types |
| `GET /directory/actors` | 200, 9 seeded actors |
| `GET /health` | 200 |
| `GET /health/ready` | 200, database ok |
| `scripts/smoke.sh` | 13 passed, exit 0 |

The app and API are served from one origin, so a single URL is all a reviewer
needs — there is no second service to start and no CORS configuration to get
wrong.

## Known gaps

Documented as specified but deliberately not implemented, recorded here so the
gap is owned rather than discovered during review.

**1. Search Index (architecture.md + data-model.md).** Both docs specify a
derived, denormalized "Search Index" over the Request Store as its own component
(`architecture.md:21,49`, `data-model.md:41`). There is no search index
anywhere — the frontend only filters already-fetched rows in memory, and there
is no backend search endpoint.

**2. Escalation engine (architecture.md:94, data-model.md:86-88).** Both docs
define `EscalationRecord` and an escalation policy (timeout → reassign to backup
approver / notify admin). The Prisma schema has no `EscalationRecord` model,
there is no escalation scheduler, and `routing.service.ts` has no timeout logic.
The `product-spec` failure scenario ("approver unavailable → auto-escalate") is
unimplemented.

**3. Email notifications (product-spec FR6).** Spec requires email (plus
optional in-app). Only in-app notifications exist
(`notifications.service.ts`); there is no email provider or delivery path.

**4. Auto duplicate detection (product-spec Failure Scenarios).** Spec says flag
likely duplicates at submission time based on requester + request type +
recency. Only explicit `idempotencyKey` replay exists; no automatic detection.

**5. File/attachment storage (architecture.md:37, data-model.md:16).** Spec says
requesters "can attach files." The API accepts only attachment *metadata*; no
upload endpoint or file storage exists (week3 acknowledges this, but the product
spec does not).

**6. User / role / department management (product-spec FR8).** "System Admin
manages users, roles, and departments." The directory is a static mock
(`directory.data.ts`, 9 hardcoded actors) with a read-only GET endpoint — no
create/update API for users, roles, or departments. The spec's distinction
between *Queue Owner* and *System Admin* is also collapsed into a single `admin`
role.

**7. Approval reversal / reopen (product-spec Failure Scenarios).** "Define
whether approvals are final or can be revoked/reopened, and by whom." Decisions
are final (409 on re-decision); there's no reopen/revise endpoint, and the
policy was never defined.

**8. Draft auto-save (product-spec Failure Scenarios).** "No data loss on
in-flight submissions (e.g. draft auto-save)." No draft persistence.

**9. SSO / identity provider (product-spec NFR, architecture.md:38).** Not
implemented; `x-actor-id` is the placeholder seam (week3 acknowledges).

## Residual risk

- **No migration history.** There is no `prisma/migrations` directory, so
  `db:push` is the only schema path. There is therefore no version-controlled
  schema and no rollback if a push is wrong. This is the main limit on the
  recovery claim: application recovery is demonstrated, schema rollback is not
  available.
- **A moderate `multer` advisory** from `npm audit` is a transitive dependency
  of `@nestjs/platform-express` on the attachment upload path. Unpatched,
  because the fix requires a framework version bump not worth introducing
  immediately before a release. Not blocking, but recorded as accepted.
- **The green gate covers the code, not the deployment.** CI proves the tests
  pass on PostgreSQL; it cannot validate Railway's provisioning, the live
  `DATABASE_URL`, or single-service serving in production. Those are covered
  here by direct observation instead.
- **Platform trial limits.** The deployment is on a time-boxed trial tier with
  metered database usage, so availability and cold-start behaviour near the
  limit of that allowance are unproven.

## Remaining work

All release evidence above is recorded against the deployed target. Two items
remain before submission:

| Item | State |
|---|---|
| Live URL, smoke run, failure/recovery, cold open | **Done** — evidenced above against the deployed target |
| README *Live App* section | Fill in the live URL, which is currently marked pending there |

## Engineering reference

Constraints that are easy to break and are not stated in the README. Setup and
the full command list live in the README's *Engineer quick start* and
*Automated verification* sections; what follows is what would otherwise be lost
with the working notes that accompanied this release.

- **Unit and e2e share one database.** `vitest.config.ts` sets
  `fileParallelism: false` so spec files run serially. Re-enabling parallelism
  makes the suites wipe each other's data — and is why the CI backend job is one
  sequential job rather than parallel jobs.
- **Run `prisma generate` before `nest build`.** The build typechecks against
  the generated client types, so a schema change without a regenerate fails the
  build rather than the runtime.
- **`STATIC_DIR` is registered with `fallthrough: true`.** A miss falls through
  to the API router, which is what keeps the asset handler from intercepting API
  routes in the single-deployment setup.
- **Schema paths in deploy commands are relative to `/app`.** The runtime
  image's working directory is `/app`, so `railway.json` references
  `./prisma/schema.prisma`, not `../backend`.
- **Tests require a reachable database.** There is no embedded fallback; the
  PostgreSQL container in the README quick start is not optional.
