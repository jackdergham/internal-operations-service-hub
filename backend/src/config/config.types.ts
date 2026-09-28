export type RoutingMode = 'direct' | 'approval';
export type ApprovalStepType = 'manager' | 'department-head' | 'specific-user';

export interface FormFieldConfig {
  key: string;
  label: string;
  type: string;
}

export interface ApprovalStepConfig {
  type: ApprovalStepType;
  actorId?: string;
}

export interface RequestTypeConfigInput {
  id: string;
  name: string;
  department: string;
  schema: {
    fields: FormFieldConfig[];
    required: string[];
  };
  routingMode: RoutingMode;
  destinationQueue: string;
  approvalChain: ApprovalStepConfig[];
}

export interface RequestTypeConfig extends RequestTypeConfigInput {
  currentVersion: number;
  updatedAt: string;
}

export interface WorkflowVersionSummary {
  id: string;
  requestTypeId: string;
  version: number;
  routingMode: RoutingMode;
  destinationQueue: string;
  approvalChain: ApprovalStepConfig[];
  publishedBy: string;
  publishedAt: string;
}
