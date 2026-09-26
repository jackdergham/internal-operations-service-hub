export type ApprovalDecision = 'approve' | 'reject';

export type ApprovalStepStatus = 'Pending' | 'Approved' | 'Rejected';

export type RoutingDecisionStatus =
  | 'Evaluating'
  | 'AwaitingApproval'
  | 'ReadyForQueue'
  | 'Rejected';

export interface ApprovalStepInstance {
  id: string;
  stepNumber: number;
  approverId: string;
  status: ApprovalStepStatus;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
}

export interface RoutingDecision {
  id: string;
  requestId: string;
  requesterId?: string;
  requestTypeId?: string;
  status: RoutingDecisionStatus;
  destinationQueue: string;
  submittedAt?: string;
  approvalSteps: ApprovalStepInstance[];
}

export interface RoutingQueueItem {
  decisionId: string;
  stepId: string;
  requestId: string;
  requesterId: string;
  requestTypeId: string;
  status: ApprovalStepStatus;
  approverId: string;
  submittedAt: string;
}

export interface DecideApprovalInput {
  approverId: string;
  decision: ApprovalDecision;
  reason?: string;
}

/**
 * What the HTTP request body actually carries. approverId is deliberately
 * absent here: it's derived from the resolved actor identity (x-actor-id),
 * not taken from client-supplied JSON, so a caller can't claim to be a
 * different approver than the one their identity resolves to.
 */
export type DecideApprovalRequestBody = Omit<DecideApprovalInput, 'approverId'>;
