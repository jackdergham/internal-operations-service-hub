![[system_diagram.svg]]

Architecture draft for the internal operations service hub

---

# Request Intake & Lifecycle

![[intake_data_flow.svg]]

Data flow of functional requirements 1 (submission), 3 (status tracking), and 10 (search) from [[product-spec]]

## Important data flows:

1. Requester selects a request type; Intake Service fetches the corresponding form schema (owned by Admin & Configuration, read-only here).
2. Requester fills the form, attaches files, and submits.
3. Intake Service validates the submission against the schema and writes a new Request record with status `Submitted`.
4. Intake Service emits a "request created" event, consumed by the Routing & Approval Engine (see below) and by Audit & History (out of scope here).
5. As the request's status changes downstream (approval, fulfillment, etc.), this component receives status-update events and updates the Request record accordingly.
6. Requester can query their own request's current status and history at any time via the Search Index.
7. Requester or Fulfiller can search/filter past requests via the Search Index, a read-optimized, derived view over the Request Store.

## Actors:

- **Requester**: submits requests, views status and history of their own requests, searches their own past requests.
- **Fulfiller / Agent**: searches/filters requests assigned to them (read access only from this component's perspective; write access to fulfillment status happens in Fulfillment & Queue Management, not yet documented).
- **System (other components)**: Routing & Approval Engine, and eventually Fulfillment & Queue Management, report status changes back to this component via events; they do not write directly to the Request Store.

## System boundary:

- **In scope for this component:** rendering/validating request submission against a request type's schema, assigning a unique request ID, owning the Request record and its status field, exposing status and search to requesters/fulfillers.
- **Out of scope for this component:** deciding routing or approval (owned by the Routing & Approval Engine, below), deciding fulfillment actions, sending notifications, computing audit history (though it emits the events audit history would be built from).

## External dependencies:

- **Admin & Configuration** (not yet documented): source of request type schemas; this component reads schemas but does not define them.
- **File / attachment storage**: needed for requester-attached files; ownership and retention policy are a dependency, not decided here.
- **Identity provider / SSO**: needed to know who the requester is at submission time.

## Trust / Authorization boundaries:

- A requester may only view/search their own requests; a fulfiller may only view/search requests assigned to their queue. (Matches [[product-spec]]'s access-control requirement.)
- Only the component that owns a given status transition (e.g. Routing & Approval Engine for approval status, Fulfillment for resolution) may update that portion of the Request record; this component applies the update but does not decide it.

## Failure scenarios:

- **Status-update event from a downstream component never arrives** (e.g. Routing & Approval Engine is down): the requester should not see stale status silently forever. Needs either an explicit "last updated" timestamp so staleness is visible, or a reconciliation/retry mechanism.
- **Duplicate submission** (double-click, resubmission after a slow response): flagged at submission time as a likely duplicate based on requester + request type + recency, per [[product-spec]]'s Failure Scenarios & Fallbacks section; advisory, not auto-blocking.
- **Search Index falls out of sync with the Request Store** (since it's a derived/denormalized view): search results may be briefly stale, but the Request Store remains the source of truth for anything status-critical. Search is never used to make a decision, only to help a human find something.

---

# Routing & Approval Engine

![[routing_data_flow.svg]]

Data flow of functional requirements 2 (routing) and 4 (approvals) from [[product-spec]] 

## Important data flows:

1. A new request (with its type and requester) becomes available to the Routing Coordinator, once it exists per the Request Intake & Lifecycle component above.
2. Routing Rule Lookup is checked for that request type.
3. If **direct**: Routing Coordinator marks the request ready for the correct fulfillment queue → done.
4. If **approval-required**: Approval Chain Resolver determines the first approver → Routing Coordinator marks the request as awaiting that approver's decision.
5. On approval: if more steps remain, resolve the next approver and repeat step 4. If this was the last step, mark the request ready for the correct fulfillment queue.
6. On rejection: the request stops here, it does not proceed to a queue.
7. Manual reassignment (by an Admin) can override the queue a request lands in at any point after routing completes.

## Actors:

- **Requester**: submits the request that needs routing (doesn't interact with this component directly, but triggers it)
- **Approver**: manager, department head, or other designated approver in a routing chain
- **Fulfiller / Agent**: receives the request once routing (and approval, if required) is complete
- **Admin**: can manually reassign a request if auto-routing sent it to the wrong place

## System boundary:

- **In scope for this component:** deciding whether a request needs approval, resolving who the approver(s) are, advancing a request through a multi-step approval chain, and handing off to the correct fulfillment queue once approval (if any) is complete.
- **Out of scope for this component:** rendering the intake form (owned by Request Intake & Lifecycle, above), storing request data long-term, actually fulfilling the request, sending notifications, and deciding how long to wait before escalating.

## External dependencies:

- **Org chart / reporting-line data**: needed to resolve "who is this requester's manager." This component reads it; it does not own or maintain it.
- **Identity provider / SSO**: needed to authenticate requesters and role assignments
- **Email delivery**: needed to notify actors involved in the requests of different status changes

## Trust / Authorization boundaries:

- Only a request's designated approver (as resolved by the Approval Chain Resolver, not just anyone) may approve or reject it at that step.
- Only an Admin may manually reassign a request's destination queue. A regular Fulfiller cannot redirect requests on their own.

## Failure scenarios:

- **Approver is unavailable or never responds**: Escalation mechanism (timeout → reassign to a backup approver or notify an Admin), the timeout values are configuration, not hardcoded.
- **Org-chart data is missing or incomplete** (e.g. requester has no manager on file): fallback to a designated default (e.g. a department head, or an Admin queue).
- **Routing rule itself is misconfigured** (e.g. a chain that loops back on itself): this should be caught before it can affect a live request, not discovered mid-flow.