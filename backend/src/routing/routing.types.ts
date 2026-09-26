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

export type DecideApprovalRequestBody = Omit<DecideApprovalInput, 'approverId'>;
