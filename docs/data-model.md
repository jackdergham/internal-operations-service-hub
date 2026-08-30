# Routing & Approval Engine

## 1. Domain

**Entities, relationships, cardinality, ownership:**

![[er_diagram.svg]]

(not sure if required but makes the below clearer)

- **RequestType**: one per request category (e.g. "New laptop", "PTO request"). Owns its RoutingRule (direct vs approval-required) and, if approval-required, an ordered ApprovalChainTemplate.
    - 1 RequestType → 1 RoutingRule
    - 1 RequestType → 0..1 ApprovalChainTemplate (only if approval-required)

- **ApprovalChainTemplate**: the configured shape of a chain (e.g. "manager → dept head"), owned by Admin & Configuration, read by this component.
    - 1 ApprovalChainTemplate → many ApprovalStepTemplate (ordered, e.g. step 1 = "requester's manager", step 2 = "requester's dept head")

- **RoutingDecision**: one per Request, created the moment a request enters this component. This is the durable record this component actually owns.
    - 1 Request (external, referenced by ID only) → 1 RoutingDecision
    - A RoutingDecision snapshots the ApprovalChainTemplate as it existed at request creation time

- **ApprovalStepInstance**: one per actual step taken for a specific request's chain (not the template, the live instance).
    - 1 RoutingDecision → many ApprovalStepInstance (ordered by step_number)
    - Each ApprovalStepInstance references exactly 1 Actor as its resolved approver

- **Actor**: a person who can act as approver (or requester). This component only needs a minimal read-only slice: identity, role, and reporting line, the authoritative record is external (org chart / directory), owned outside this component.
    - Actor → 0..1 Actor (self-referential `manager_id`, used to resolve approval chains)

- **EscalationRecord**: one per escalation event (an ApprovalStepInstance that timed out).
    - 1 ApprovalStepInstance → 0..many EscalationRecord (usually 0 or 1, but a step could reescalate if the backup approver also doesn't respond)

**Ownership summary:**
- Owned here: RoutingDecision, ApprovalStepInstance, EscalationRecord
- Read-only, owned elsewhere: RequestType, RoutingRule, ApprovalChainTemplate (Admin & Configuration), Actor/org-chart data (external directory), Request itself (Intake & Lifecycle)
## 2. Lifecycle + Rules

**RoutingDecision status transitions:** `Evaluating → Direct` (terminal, if no approval needed) `Evaluating → AwaitingApproval → Approved → ReadyForQueue` (terminal) `AwaitingApproval → Rejected` (terminal, per [[architecture]] step 6, a rejected request does not proceed)

**ApprovalStepInstance status transitions:** `Pending → Approved` (advances to next step, or completes the chain) `Pending → Rejected` (terminal for the whole RoutingDecision, not just this step) `Pending → Escalated → Pending` (re-assigned to backup approver, timer restarts. This is the loop implied by [[architecture]]'s failure-scenario handling)

**Invariants:**
- An ApprovalStepInstance can be decided (approved/rejected) exactly once. A decision is not editable after the fact (echoes the [[product-spec]]'s general auditability requirement, applied locally to this component's own state).
- The `approver` on an ApprovalStepInstance must match the Actor resolved by the Approval Chain Resolver for that step. Nobody else's decision is valid, even if submitted (this is the authorization-sensitive rule from [[architecture]]'s Trust boundary).
- A RoutingDecision has at most one ApprovalStepInstance in `Pending` state at a time. Steps are strictly sequential, never parallel (matches "sequential multi-step approval" in the [[product-spec]]).
- An EscalationRecord does not itself decide anything, it only reassigns the approver on the existing (still-Pending) step; the step's decision history is preserved, not replaced.
## 3. Storage

**Durable vs. derived:**
- **Durable:** RoutingDecision, ApprovalStepInstance (including who decided, when, and any rejection reason), EscalationRecord. These are the facts this component must never lose. They're what an audit trail (owned elsewhere) will later read from.
- **Snapshotted, not live-referenced:** each RoutingDecision copies the ApprovalChainTemplate that applied at request creation time, rather than pointing at the live, editable template. This is a direct consequence of [[architecture]]'s resilience note that a routing rule change must not retroactively affect a request already mid-flow.
- **Derived, not stored:** "is this request currently awaiting approval" is derivable from the latest ApprovalStepInstance status. It doesn't need its own stored flag, avoiding a second source of truth that could drift out of sync.

**Relational vs. document reasoning:**
- This domain is a strong fit for **relational** modeling: ApprovalStepInstances are strictly ordered, reference a specific RoutingDecision and a specific Actor, and need referential integrity (a step must belong to exactly one decision; a decision must belong to exactly one request). A document / nested-object approach would make "find all steps currently awaiting approver X across every request" awkward, and that's one of the component's most important queries.
- Actor data is read-only from this component's perspective. It doesn't need its own storage here at all, only a reference (ID) into wherever the org-chart / directory data actually lives.
## 4. Access

**Important queries / access patterns:**
- "What is the current pending step for request X?"; the primary read for a requester or fulfiller checking status.
- "What's in my approval queue?" (approver's view); find all ApprovalStepInstances where `approver_id = Y` and `status = Pending`. This is the component's highest-frequency query and justifies a compound index on `(approver_id, status)`.
- "Which pending steps have exceeded their timeout?". Used by the escalation scheduler; needs a query over `status = Pending` filtered by an elapsed-time threshold. Justifies an index on `(status, step_started_at)` rather than scanning all pending steps.
- "Who is this requester's manager?"; a read against Actor by `manager_id`, used once per approval-chain resolution. No dedicated index needed beyond the Actor table's own primary key, since this component doesn't own or heavily query that table.

**Indexes when justified (per the above):**
- `(approver_id, status)` on ApprovalStepInstance. Supports the approver-queue query
- `(status, step_started_at)` on ApprovalStepInstance. Supports the escalation sweep
- `request_id` on RoutingDecision. Supports the single-request status lookup
- No index proposed on RoutingDecision.status alone. Current known queries always filter by request or by approver/time, not by decision status in isolation.