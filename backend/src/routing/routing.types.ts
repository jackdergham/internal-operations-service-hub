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
  status: RoutingDecisionStatus;
  destinationQueue: string;
  approvalSteps: ApprovalStepInstance[];
}

export interface DecideApprovalInput {
  approverId: string;
  decision: ApprovalDecision;
  reason?: string;
}
