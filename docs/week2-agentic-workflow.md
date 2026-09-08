This document records how the bounded backend behavior below was built using an AI agent; what it was asked to do, how its work was directed and checked, and the evidence that it works.

**Week 1 sources used:**

- [x] product-spec.md: requirements 2 (routing), 4 (approvals), and 7 (audit trail)
- [x] architecture.md: Routing Coordinator and Approval Chain Resolver boundary
- [x] data-model.md: `RoutingDecision` and `ApprovalStepInstance` lifecycles
- [x] ADR-001.md: approval chains are ordered steps; a single approver is a one-step chain

**States + rules + invariant (from Week 1):**

- States: `ApprovalStepInstance`: `Pending → Approved` or `Pending → Rejected`.
	`RoutingDecision`: `AwaitingApproval → ReadyForQueue` or `AwaitingApproval → Rejected`.
- Rules governing transitions: only a pending step may be decided; the submitted approver must match the designated approver; rejection requires a reason; rejection is terminal for the routing decision.
- Invariant being enforced: an approval step can be decided exactly once, and only its resolved approver may decide it.

**Implementation area:** A single HTTP endpoint that transitions an in-memory `ApprovalStepInstance` and updates its parent `RoutingDecision`. This is not the whole routing engine.

**Explicit non-goals (for now):**

- No frontend
- No production database; data is seeded and stored in memory
- No authentication or SSO; `approverId` is supplied in the request body
- No org-chart / directory integration
- No notification delivery
- No escalation scheduler
- No request submission forms or fulfillment queue implementation
- No full multi-step approval resolver

**Bounded task given to the agent:** 

- Implement a NestJS HTTP endpoint for approving or rejecting a pending approval step. 
- Use in-memory data only. 
- Enforce that the routing decision and step exist, the step is pending, the submitted approver matches the designated approver, and rejection includes a reason. 
- Preserve the decision after it is made, reject duplicate decisions, and add focused unit and HTTP tests.

**Relevant context provided:** The Week 1 product specification, architecture, data model, and ADR; the generated NestJS starter in `backend/`; and the requirement to use the agentic workflow template to document one bounded behavior.

**Inspected before modifying:** The generated `AppModule`, `AppController`, `AppService`, existing unit and e2e tests, TypeScript configuration, Vitest configuration, and backend package scripts.

**Plan agreed before execution:** Add a `routing` module containing domain types, an in-memory `RoutingService`, and a controller. Expose `POST /routing-decisions/:decisionId/steps/:stepId/decision`. Seed `decision-1` with pending `step-1`, assigned to `manager-1`, and destined for the `it-support` queue. Return `201` for a valid HTTP decision; use `400` for malformed input, `403` for the wrong approver, `404` for missing records, and `409` for a previously decided step. 

The agent also planned for unit and end-to-end tests since he inspected the generated nest template. Although not required for this week, decided to keep them for now since they will be relevant later.

**Approve / Redirect / Stop log:**

|Moment|Action|Why|
|---|---|---|
|Initial bounded endpoint proposal|Approved|It isolates one testable approval transition instead of attempting the full routing product.|
|In-memory seeded implementation|Approved|The Week 2 scope explicitly excludes a production database and integrations.|
|Build reported a type-only import error|Redirected|Changed the decorated controller parameter to a type-only import required by `isolatedModules` and decorator metadata.|
|Lint reported an unused import|Redirected|Removed the unused type import and reran verification.|

**Valid transition cases (2+):**

|Case|Input|Expected|Actual|Result|
|---|---|---|---|---|
|1|`POST /routing-decisions/decision-1/steps/step-1/decision` with `{"approverId":"manager-1","decision":"approve"}`|HTTP `201`; step becomes `Approved`; decision becomes `ReadyForQueue`|HTTP e2e test passed; returned status was `ReadyForQueue` and step status was `Approved`|Pass|
|2|Service call with `{"approverId":"manager-1","decision":"reject","reason":"Budget is not available"}`|Step becomes `Rejected`; decision becomes `Rejected`; reason is preserved|Unit test passed; rejection reason was retained|Pass|

**Invalid transition cases (2+):**

|Case|Input|Expected (rejection)|Actual|Result|
|---|---|---|---|---|
|1|Wrong approver: `approverId = another-actor`|`403 Forbidden`; state remains pending|Unit and e2e tests raised/returned `403 Forbidden`|Pass|
|2|Rejection without `reason`|`400 Bad Request`; state remains pending|Unit and e2e tests raised/returned `400 Bad Request`|Pass|
|3|Second decision after approval|`409 Conflict`; original decision remains unchanged|Unit test raised `ConflictException`|Pass|
|4|Unknown routing decision or approval step|`404 Not Found`|Service implementation raises `NotFoundException`|Pass|

**Invariant check:** The duplicate-decision unit test first approves `step-1`, then attempts to reject the same step. The second decision is rejected with `ConflictException`, proving that a decided step cannot be decided again. The wrong-approver tests prove that only `manager-1`, the designated approver, may decide the seeded step.

**Defects found:**

- Build failed with TypeScript `TS1272` for `DecideApprovalInput` in a decorated controller parameter → changed the import to `import type` → build passed.
- Lint reported unused `ApprovalStepInstance` import → removed the import → lint passed.

**Regression check:** Final verification passed after both fixes: `npm run lint`, `npm run build`, `npm test` (2 files, 6 tests), and `npm run test:e2e` (1 file, 4 tests).

**Final commit:** No final commit created. Currently pushing progress made.