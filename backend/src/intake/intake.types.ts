export interface AttachmentInput {
  filename: string;
  size: number;
  contentType: string;
  storageReference: string;
}

export interface CreateRequestInput {
  requesterId: string;
  requestTypeId: string;
  description: string;
  formData: Record<string, unknown>;
  attachments?: AttachmentInput[];
  idempotencyKey?: string;
}

export interface CreateRequestResponse {
  request: {
    id: string;
    requesterId: string;
    requestTypeId: string;
    description: string;
    formData: unknown;
    status: string;
    createdAt: string;
    attachments: AttachmentInput[];
    statusEvents: Array<{
      status: string;
      source: string;
      createdAt: string;
    }>;
  };
  replayed: boolean;
}
