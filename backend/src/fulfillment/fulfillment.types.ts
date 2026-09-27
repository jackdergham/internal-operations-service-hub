export type CommentVisibility = 'internal' | 'requester-visible';

export interface AddCommentInput {
  body: string;
  visibility?: CommentVisibility;
}

export interface ReassignInput {
  queue: string;
}

export interface FulfillmentComment {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
}

export interface QueueItem {
  requestId: string;
  requesterId: string;
  requestTypeId: string;
  description: string;
  status: string;
  queue: string;
  assignedFulfillerId: string | null;
  createdAt: string;
}
