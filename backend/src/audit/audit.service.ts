import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../directory/directory.types.js';
import type { RequestAudit } from './audit.types.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getRequestAudit(requestId: string, actor: Actor): Promise<RequestAudit> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        statusEvents: true,
        fulfillmentComments: true,
        queueAssignment: true,
        routingDecision: { include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } } },
      },
    });
    if (!request) throw new NotFoundException('Request not found');

    this.requireAccess(request, actor);

    const canSeeInternalComments = actor.roles.includes('admin') || actor.roles.includes('fulfiller');

    return {
      requestId: request.id,
      requesterId: request.requesterId,
      requestTypeId: request.requestTypeId,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      statusEvents: request.statusEvents
        .slice()
        .sort((a: (typeof request.statusEvents)[number], b: (typeof request.statusEvents)[number]) =>
          a.createdAt.getTime() - b.createdAt.getTime())
        .map((event: (typeof request.statusEvents)[number]) => ({
          status: event.status,
          source: event.source,
          createdAt: event.createdAt.toISOString(),
        })),
      routingDecision: request.routingDecision
        ? {
            status: request.routingDecision.status,
            destinationQueue: request.routingDecision.destinationQueue,
            approvalSteps: request.routingDecision.approvalSteps.map(
              (step: (typeof request.routingDecision.approvalSteps)[number]) => ({
                stepNumber: step.stepNumber,
                approverId: step.approverId,
                status: step.status,
                decidedBy: step.decidedBy ?? undefined,
                decidedAt: step.decidedAt ? step.decidedAt.toISOString() : undefined,
                rejectionReason: step.rejectionReason ?? undefined,
              }),
            ),
          }
        : null,
      comments: request.fulfillmentComments
        .filter((comment: (typeof request.fulfillmentComments)[number]) =>
          canSeeInternalComments || comment.visibility === 'requester-visible')
        .sort((a: (typeof request.fulfillmentComments)[number], b: (typeof request.fulfillmentComments)[number]) =>
          a.createdAt.getTime() - b.createdAt.getTime())
        .map((comment: (typeof request.fulfillmentComments)[number]) => ({
          id: comment.id,
          authorId: comment.authorId,
          body: comment.body,
          visibility: comment.visibility as 'internal' | 'requester-visible',
          createdAt: comment.createdAt.toISOString(),
        })),
    };
  }

  private requireAccess(
    request: {
      requesterId: string;
      queueAssignment: { queue: string; assignedFulfillerId: string | null } | null;
      routingDecision: { approvalSteps: { approverId: string }[] } | null;
    },
    actor: Actor,
  ): void {
    if (actor.employeeId === request.requesterId) return;
    if (actor.roles.includes('admin')) return;
    if (request.queueAssignment?.assignedFulfillerId === actor.employeeId) return;
    if (actor.roles.includes('fulfiller') && request.queueAssignment?.queue === actor.department) return;
    if (request.routingDecision?.approvalSteps.some((step) => step.approverId === actor.employeeId)) return;

    throw new ForbiddenException("You do not have access to this request's audit trail");
  }
}
