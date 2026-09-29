export interface AuditStatusEvent {
  status: string;
  source: string;
  createdAt: string;
}

export interface AuditApprovalStep {
  stepNumber: number;
  approverId: string;
  status: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
}

export interface AuditRoutingDecision {
  status: string;
  destinationQueue: string;
  approvalSteps: AuditApprovalStep[];
}

export interface AuditComment {
  id: string;
  authorId: string;
  body: string;
  visibility: 'internal' | 'requester-visible';
  createdAt: string;
}

export interface RequestAudit {
  requestId: string;
  requesterId: string;
  requestTypeId: string;
  status: string;
  createdAt: string;
  statusEvents: AuditStatusEvent[];
  routingDecision: AuditRoutingDecision | null;
  comments: AuditComment[];
}
