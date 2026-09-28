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
import type { ApprovalStepConfig, RoutingMode } from '../config/config.types.js';

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
      await this.addRequestDecision(
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

    const decision = await this.addRequestDecision(
      request.id,
      request.requesterId,
      request.requestTypeId,
      request.createdAt,
      request.department,
    );

    if (!this.prisma) return;

    if (decision.status === 'ReadyForQueue') {
      await this.fulfillmentService?.registerReadyForQueue({ id: request.id, queue: decision.destinationQueue });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.request.update({ where: { id: request.id }, data: { status: 'Pending Approval' } }),
      this.prisma.statusEvent.create({
        data: { id: randomUUID(), requestId: request.id, status: 'Pending Approval', source: 'routing' },
      }),
    ]);

    const firstStep = decision.approvalSteps[0];
    await this.notificationsService?.create({
      recipientId: request.requesterId,
      type: 'approval-requested',
      title: 'Approval requested',
      message: `${request.id} is waiting for approval.`,
      requestId: request.id,
    });
    if (firstStep) {
      await this.notificationsService?.create({
        recipientId: firstStep.approverId,
        type: 'approval-requested',
        title: 'Approval needed',
        message: `You have an approval request for ${request.id}.`,
        requestId: request.id,
      });
    }
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

    const step = routingDecision.approvalSteps.find(({ id }) => id === stepId)
      ?? (stepId === `step-${routingDecision.requestId}` ? routingDecision.approvalSteps[0] : undefined);
    if (!step) throw new NotFoundException('Approval step not found');

    this.validateInput(input);
    if (step.status !== 'Pending') throw new ConflictException('Approval step has already been decided');
    if (step.approverId !== input.approverId) {
      throw new ForbiddenException('Only the designated approver may decide this step');
    }

    step.status = input.decision === 'approve' ? 'Approved' : 'Rejected';
    step.decidedBy = input.approverId;
    step.decidedAt = new Date().toISOString();
    if (input.decision === 'reject') step.rejectionReason = input.reason;

    if (input.decision === 'approve') {
      const nextStep = routingDecision.approvalSteps.find((candidate) => candidate.stepNumber === step.stepNumber + 1);
      if (nextStep) {
        routingDecision.status = 'AwaitingApproval';
        if (this.prisma && routingDecision.requestId !== 'request-1') {
          await this.prisma.statusEvent.create({
            data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Pending Approval', source: 'routing' },
          });
        }
        await this.notificationsService?.create({
          recipientId: nextStep.approverId,
          type: 'approval-requested',
          title: 'Approval needed',
          message: `You have the next approval step for ${routingDecision.requestId}.`,
          requestId: routingDecision.requestId,
        });
      } else {
        routingDecision.status = 'ReadyForQueue';
      }
    } else {
      routingDecision.status = 'Rejected';
    }

    if (this.prisma && routingDecision.requestId !== 'request-1') {
      if (input.decision === 'reject') {
        await this.prisma.$transaction([
          this.prisma.request.update({ where: { id: routingDecision.requestId }, data: { status: 'Rejected' } }),
          this.prisma.statusEvent.create({
            data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Rejected', source: 'routing' },
          }),
        ]);
        await this.notificationsService?.create({
          recipientId: routingDecision.requesterId ?? 'unknown',
          type: 'request-rejected',
          title: 'Request rejected',
          message: `${routingDecision.requestId} was rejected.`,
          requestId: routingDecision.requestId,
        });
      } else if (routingDecision.status === 'ReadyForQueue') {
        await this.prisma.$transaction([
          this.prisma.request.update({ where: { id: routingDecision.requestId }, data: { status: 'Approved' } }),
          this.prisma.statusEvent.create({
            data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Approved', source: 'routing' },
          }),
        ]);
        await this.notificationsService?.create({
          recipientId: routingDecision.requesterId ?? 'unknown',
          type: 'request-approved',
          title: 'Request approved',
          message: `${routingDecision.requestId} was approved.`,
          requestId: routingDecision.requestId,
        });
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

  private async addRequestDecision(
    id: string,
    requesterId: string,
    requestTypeId: string,
    submittedAt: Date,
    department?: string,
  ): Promise<RoutingDecision> {
    const decisionId = `decision-${id}`;
    const existing = this.decisions.get(decisionId);
    if (existing) return existing;

    const config = this.prisma
      ? await this.prisma.requestType.findUnique({ where: { id: requestTypeId } })
      : null;
    const routingMode = (config?.routingMode ?? 'approval') as RoutingMode;
    const destinationQueue = config?.destinationQueue ?? department ?? DEFAULT_QUEUE;
    const approvalChain = Array.isArray(config?.approvalChain) ? config.approvalChain as unknown as ApprovalStepConfig[] : [{ type: 'manager' as const }];
    const approvalSteps = routingMode === 'direct'
      ? []
      : approvalChain.map((step, index) => ({
          id: `step-${id}-${index + 1}`,
          stepNumber: index + 1,
          approverId: this.resolveConfiguredApprover(requesterId, step),
          status: 'Pending' as const,
        }));

    const decision: RoutingDecision = {
      id: decisionId,
      requestId: id,
      requesterId,
      requestTypeId,
      status: routingMode === 'direct' ? 'ReadyForQueue' : 'AwaitingApproval',
      destinationQueue,
      submittedAt: submittedAt.toISOString(),
      approvalSteps,
    };
    this.decisions.set(decisionId, decision);
    return decision;
  }

  private resolveConfiguredApprover(requesterId: string, step: ApprovalStepConfig): string {
    if (step.type === 'specific-user') return step.actorId ?? DEFAULT_APPROVER;
    const managerId = this.directoryService?.getManagerId(requesterId) ?? managerByRequester[requesterId] ?? DEFAULT_APPROVER;
    if (step.type === 'manager') return managerId;
    return this.directoryService?.getManagerId(managerId) ?? DEFAULT_APPROVER;
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
