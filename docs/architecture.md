![[system_diagram.svg]]

Architecture draft for the internal operations service hub

![[routing_diagram.svg]]

Data flow of functional requirements 2 (routing) and 4 (approvals) from [[product-spec]] 
# Important data flows:

1. A new request (with its type and requester) becomes available to the Routing Coordinator.
2. Routing Rule Lookup is checked for that request type.
3. If **direct**: Routing Coordinator marks the request ready for the correct fulfillment queue → done.
4. If **approval-required**: Approval Chain Resolver determines the first approver → Routing Coordinator marks the request as awaiting that approver's decision.
5. On approval: if more steps remain, resolve the next approver and repeat step 4. If this was the last step, mark the request ready for the correct fulfillment queue.
6. On rejection: the request stops here, it does not proceed to a queue.
7. Manual reassignment (by an Admin) can override the queue a request lands in at any point after routing completes.
# Actors:

- **Requester**: submits the request that needs routing (doesn't interact with this component directly, but triggers it)
- **Approver**: manager, department head, or other designated approver in a routing chain
- **Fulfiller / Agent**: receives the request once routing (and approval, if required) is complete
- **Admin**: can manually reassign a request if auto-routing sent it to the wrong place
# System boundary:

- **In scope for this component:** deciding whether a request needs approval, resolving who the approver(s) are, advancing a request through a multi-step approval chain, and handing off to the correct fulfillment queue once approval (if any) is complete.
- **Out of scope for this component:** rendering the intake form, storing request data long-term, actually fulfilling the request, sending notifications, and deciding how long to wait before escalating.
# External dependencies:

- **Org chart / reporting-line data**: needed to resolve "who is this requester's manager." This component reads it; it does not own or maintain it.
- **Identity provider / SSO**: needed to authenticate requesters and role assignments
- **Email delivery**: needed to notify actors involved in the requests of different status changes 
# Trust / Authorization boundaries:

- Only a request's designated approver (as resolved by the Approval Chain Resolver, not just anyone) may approve or reject it at that step.
- Only an Admin may manually reassign a request's destination queue. A regular Fulfiller cannot redirect requests on their own.
# Failure scenarios:

- **Approver is unavailable or never responds**: Escalation mechanism (timeout → reassign to a backup approver or notify an Admin), the timeout values are configuration, not hardcoded.
- **Org-chart data is missing or incomplete** (e.g. requester has no manager on file): fallback to a designated default (e.g. a department head, or an Admin queue).
- **Routing rule itself is misconfigured** (e.g. a chain that loops back on itself): this should be caught before it can affect a live request, not discovered mid-flow.