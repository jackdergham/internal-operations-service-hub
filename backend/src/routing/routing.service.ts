import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { FulfillmentService } from '../fulfillment/fulfillment.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DecideApprovalInput, RoutingDecision, RoutingQueueItem } from './routing.types.js';

const DEFAULT_QUEUE = 'General';

const managerByRequester: Record<string, string> = {
  'employee-1': 'manager-1',
  'employee-2': 'manager-2',
};
const DEFAULT_APPROVER = 'manager-1';

@Injectable()
export class RoutingService implements OnModuleInit {
  private readonly decisions = new Map<string, RoutingDecision>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly directoryService?: DirectoryService,
    @Optional() private readonly fulfillmentService?: FulfillmentService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {
    this.addSeedDecision();
  }

  async onModuleInit(): Promise<void> {
    if (!this.prisma) return;

    const pendingRequests = await this.prisma.request.findMany({
      where: { status: 'Pending Approval' },
      orderBy: { createdAt: 'asc' },
      include: { requestType: true },
    });

    for (const request of pendingRequests) {
      this.addRequestDecision(
        request.id,
        request.requesterId,
        request.requestTypeId,
        request.createdAt,
        request.requestType.department,
      );
    }
  }

  async registerRequest(request: {
    id: string;
    requesterId: string;
    requestTypeId: string;
    createdAt: Date;
    department?: string;
  }): Promise<void> {
    if (this.decisions.has(`decision-${request.id}`)) return;

    this.addRequestDecision(
      request.id,
      request.requesterId,
      request.requestTypeId,
      request.createdAt,
      request.department,
    );

    if (!this.prisma) return;

    await this.prisma.$transaction([
      this.prisma.request.update({ where: { id: request.id }, data: { status: 'Pending Approval' } }),
      this.prisma.statusEvent.create({
        data: { id: randomUUID(), requestId: request.id, status: 'Pending Approval', source: 'routing' },
      }),
    ]);

    await this.notificationsService?.create({
      recipientId: request.requesterId,
      type: 'approval-requested',
      title: 'Approval requested',
      message: `${request.id} is waiting for approval.`,
      requestId: request.id,
    });
    await this.notificationsService?.create({
      recipientId: this.resolveApprover(request.requesterId),
      type: 'approval-requested',
      title: 'Approval needed',
      message: `You have an approval request for ${request.id}.`,
      requestId: request.id,
    });
  }

  listQueue(approverId: string): RoutingQueueItem[] {
    const items: RoutingQueueItem[] = [];

    for (const decision of this.decisions.values()) {
      const step = decision.approvalSteps.find(
        (candidate) => candidate.status === 'Pending' && candidate.approverId === approverId,
      );
      if (!step) continue;

      items.push({
        decisionId: decision.id,
        stepId: step.id,
        requestId: decision.requestId,
        requesterId: decision.requesterId ?? 'unknown',
        requestTypeId: decision.requestTypeId ?? 'unknown',
        status: step.status,
        approverId: step.approverId,
        submittedAt: decision.submittedAt ?? new Date(0).toISOString(),
      });
    }

    return items;
  }

  async decideApproval(decisionId: string, stepId: string, input: DecideApprovalInput): Promise<RoutingDecision> {
    const routingDecision = this.decisions.get(decisionId);
    if (!routingDecision) throw new NotFoundException('Routing decision not found');

    const step = routingDecision.approvalSteps.find(({ id }) => id === stepId);
    if (!step) throw new NotFoundException('Approval step not found');

    this.validateInput(input);
    if (step.status !== 'Pending') throw new ConflictException('Approval step has already been decided');
    if (step.approverId !== input.approverId) {
      throw new ForbiddenException('Only the designated approver may decide this step');
    }

    step.status = input.decision === 'approve' ? 'Approved' : 'Rejected';
    step.decidedBy = input.approverId;
    step.decidedAt = new Date().toISOString();
    routingDecision.status = input.decision === 'approve' ? 'ReadyForQueue' : 'Rejected';
    if (input.decision === 'reject') step.rejectionReason = input.reason;

    if (this.prisma && routingDecision.requestId !== 'request-1') {
      const requestStatus = input.decision === 'approve' ? 'Approved' : 'Rejected';
      await this.prisma.$transaction([
        this.prisma.request.update({ where: { id: routingDecision.requestId }, data: { status: requestStatus } }),
        this.prisma.statusEvent.create({
          data: { id: randomUUID(), requestId: routingDecision.requestId, status: requestStatus, source: 'routing' },
        }),
      ]);

      await this.notificationsService?.create({
        recipientId: routingDecision.requesterId ?? 'unknown',
        type: requestStatus === 'Approved' ? 'request-approved' : 'request-rejected',
        title: `Request ${requestStatus.toLowerCase()}`,
        message: `${routingDecision.requestId} was ${requestStatus.toLowerCase()}.`,
        requestId: routingDecision.requestId,
      });

      if (input.decision === 'approve') {
        await this.fulfillmentService?.registerReadyForQueue({
          id: routingDecision.requestId,
          queue: routingDecision.destinationQueue,
        });
      }
    }

    return this.cloneDecision(routingDecision);
  }

  private addSeedDecision(): void {
    this.decisions.set('decision-1', {
      id: 'decision-1', requestId: 'request-1', requesterId: 'employee-1', requestTypeId: 'new-laptop',
      status: 'AwaitingApproval', destinationQueue: 'IT', submittedAt: new Date().toISOString(),
      approvalSteps: [{ id: 'step-1', stepNumber: 1, approverId: 'manager-1', status: 'Pending' }],
    });
  }

  private addRequestDecision(
    id: string,
    requesterId: string,
    requestTypeId: string,
    submittedAt: Date,
    department?: string,
  ): void {
    const decisionId = `decision-${id}`;
    if (this.decisions.has(decisionId)) return;

    this.decisions.set(decisionId, {
      id: decisionId, requestId: id, requesterId, requestTypeId, status: 'AwaitingApproval',
      destinationQueue: department ?? DEFAULT_QUEUE, submittedAt: submittedAt.toISOString(),
      approvalSteps: [{ id: `step-${id}`, stepNumber: 1, approverId: this.resolveApprover(requesterId), status: 'Pending' }],
    });
  }

  private resolveApprover(requesterId: string): string {
    return (
      this.directoryService?.getManagerId(requesterId) ??
      managerByRequester[requesterId] ??
      DEFAULT_APPROVER
    );
  }

  private validateInput(input: DecideApprovalInput): void {
    if (!input || typeof input.approverId !== 'string' || input.approverId.length === 0) {
      throw new BadRequestException('approverId is required');
    }
    if (input.decision !== 'approve' && input.decision !== 'reject') {
      throw new BadRequestException('decision must be approve or reject');
    }
    if (input.decision === 'reject' && (!input.reason || input.reason.trim().length === 0)) {
      throw new BadRequestException('reason is required when rejecting an approval step');
    }
  }

  private cloneDecision(decision: RoutingDecision): RoutingDecision {
    return { ...decision, approvalSteps: decision.approvalSteps.map((step) => ({ ...step })) };
  }
}
