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
const DEFAULT_APPROVER = 'manager-1';
const managerByRequester: Record<string, string> = {
  'employee-1': 'manager-1',
  'employee-2': 'manager-2',
};

type RoutingDecisionRow = {
  id: string;
  requestId: string;
  requestTypeId: string;
  requesterId: string;
  status: string;
  destinationQueue: string;
  createdAt: Date;
  approvalSteps: ApprovalStepRow[];
};

type ApprovalStepRow = {
  id: string;
  routingDecisionId: string;
  stepNumber: number;
  approverId: string;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  rejectionReason: string | null;
};

@Injectable()
export class RoutingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directoryService: DirectoryService,
    @Optional() private readonly fulfillmentService?: FulfillmentService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const pendingWithoutDecision = await this.prisma.request.findMany({
      where: { status: 'Pending Approval', routingDecision: null },
      include: { requestType: true },
    });

    for (const request of pendingWithoutDecision) {
      await this.createRoutingDecision(
        request.id,
        request.requesterId,
        request.requestTypeId,
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
    const existing = await this.prisma.routingDecision.findUnique({ where: { requestId: request.id } });
    if (existing) return;

    const decision = await this.createRoutingDecision(
      request.id,
      request.requesterId,
      request.requestTypeId,
      request.department,
    );

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

    await this.notificationsService?.create({
      recipientId: request.requesterId,
      type: 'approval-requested',
      title: 'Approval requested',
      message: `${request.id} is waiting for approval.`,
      requestId: request.id,
    });
    const firstStep = decision.approvalSteps[0];
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

  async listQueue(approverId: string): Promise<RoutingQueueItem[]> {
    const steps = await this.prisma.approvalStepInstance.findMany({
      where: { approverId, status: 'Pending' },
      include: { routingDecision: true },
      orderBy: { createdAt: 'asc' },
    });

    return steps.map((step: (typeof steps)[number]) => ({
      decisionId: step.routingDecision.id,
      stepId: step.id,
      requestId: step.routingDecision.requestId,
      requesterId: step.routingDecision.requesterId,
      requestTypeId: step.routingDecision.requestTypeId,
      status: step.status as RoutingQueueItem['status'],
      approverId: step.approverId,
      submittedAt: step.routingDecision.createdAt.toISOString(),
    }));
  }

  async decideApproval(decisionId: string, stepId: string, input: DecideApprovalInput): Promise<RoutingDecision> {
    this.validateInput(input);

    const step = await this.prisma.approvalStepInstance.findUnique({
      where: { id: stepId },
      include: { routingDecision: { include: { approvalSteps: true } } },
    });
    if (!step || step.routingDecisionId !== decisionId) {
      throw new NotFoundException('Approval step not found');
    }
    if (step.status !== 'Pending') throw new ConflictException('Approval step has already been decided');
    if (step.approverId !== input.approverId) {
      throw new ForbiddenException('Only the designated approver may decide this step');
    }

    const routingDecision = step.routingDecision;
    if (step.stepNumber > 1) {
      const previousStep = routingDecision.approvalSteps.find(
        (candidate: (typeof routingDecision.approvalSteps)[number]) => candidate.stepNumber === step.stepNumber - 1,
      );
      if (previousStep && previousStep.status === 'Pending') {
        throw new ConflictException('An earlier approval step is still pending');
      }
    }
    const nextStep = input.decision === 'approve'
      ? routingDecision.approvalSteps.find(
          (candidate: (typeof routingDecision.approvalSteps)[number]) => candidate.stepNumber === step.stepNumber + 1,
        )
      : undefined;
    const newDecisionStatus = input.decision === 'reject'
      ? 'Rejected'
      : nextStep
        ? 'AwaitingApproval'
        : 'ReadyForQueue';

    await this.prisma.$transaction([
      this.prisma.approvalStepInstance.update({
        where: { id: stepId },
        data: {
          status: input.decision === 'approve' ? 'Approved' : 'Rejected',
          decidedBy: input.approverId,
          decidedAt: new Date(),
          rejectionReason: input.decision === 'reject' ? input.reason : null,
        },
      }),
      this.prisma.routingDecision.update({
        where: { id: decisionId },
        data: { status: newDecisionStatus },
      }),
      ...(nextStep
        ? [this.prisma.approvalStepInstance.update({
            where: { id: nextStep.id },
            data: { status: 'Pending' },
          })]
        : []),
    ]);

    if (input.decision === 'reject') {
      await this.prisma.$transaction([
        this.prisma.request.update({ where: { id: routingDecision.requestId }, data: { status: 'Rejected' } }),
        this.prisma.statusEvent.create({
          data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Rejected', source: 'routing' },
        }),
      ]);
      await this.notificationsService?.create({
        recipientId: routingDecision.requesterId,
        type: 'request-rejected',
        title: 'Request rejected',
        message: `${routingDecision.requestId} was rejected.`,
        requestId: routingDecision.requestId,
      });
    } else if (nextStep) {
      await this.prisma.statusEvent.create({
        data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Pending Approval', source: 'routing' },
      });
      await this.notificationsService?.create({
        recipientId: nextStep.approverId,
        type: 'approval-requested',
        title: 'Approval needed',
        message: `You have the next approval step for ${routingDecision.requestId}.`,
        requestId: routingDecision.requestId,
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.request.update({ where: { id: routingDecision.requestId }, data: { status: 'Approved' } }),
        this.prisma.statusEvent.create({
          data: { id: randomUUID(), requestId: routingDecision.requestId, status: 'Approved', source: 'routing' },
        }),
      ]);
      await this.notificationsService?.create({
        recipientId: routingDecision.requesterId,
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

    return this.mustFindDecisionDto(decisionId);
  }

  async findDecisionForRequest(requestId: string): Promise<RoutingDecision | null> {
    const row = await this.prisma.routingDecision.findUnique({
      where: { requestId },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    return row ? this.toDto(row) : null;
  }

  private async createRoutingDecision(
    id: string,
    requesterId: string,
    requestTypeId: string,
    department?: string,
  ): Promise<RoutingDecision> {
    const requestTypeConfig = await this.prisma.requestType.findUnique({ where: { id: requestTypeId } });
    const routingMode = (requestTypeConfig?.routingMode ?? 'approval') as RoutingMode;
    const destinationQueue = requestTypeConfig?.destinationQueue ?? department ?? DEFAULT_QUEUE;
    const approvalChain = Array.isArray(requestTypeConfig?.approvalChain)
      ? (requestTypeConfig.approvalChain as unknown as ApprovalStepConfig[])
      : [{ type: 'manager' as const }];

    const decisionId = `decision-${id}`;
    const status: RoutingDecision['status'] = routingMode === 'direct' ? 'ReadyForQueue' : 'AwaitingApproval';

    const row = await this.prisma.routingDecision.create({
      data: {
        id: decisionId,
        requestId: id,
        requestTypeId,
        requesterId,
        status,
        destinationQueue,
        approvalSteps: routingMode === 'direct'
          ? undefined
          : {
              create: approvalChain.map((step, index) => ({
                id: `${decisionId}-step-${index + 1}`,
                stepNumber: index + 1,
                approverId: this.resolveConfiguredApprover(requesterId, step),
                status: index === 0 ? 'Pending' : 'Blocked',
              })),
            },
      },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });

    return this.toDto(row);
  }

  private resolveConfiguredApprover(requesterId: string, step: ApprovalStepConfig): string {
    if (step.type === 'specific-user') return step.actorId ?? DEFAULT_APPROVER;
    const managerId = this.directoryService.getManagerId(requesterId) ?? managerByRequester[requesterId] ?? DEFAULT_APPROVER;
    if (step.type === 'manager') return managerId;
    return this.directoryService.getManagerId(managerId) ?? DEFAULT_APPROVER;
  }

  private async mustFindDecisionDto(decisionId: string): Promise<RoutingDecision> {
    const row = await this.prisma.routingDecision.findUnique({
      where: { id: decisionId },
      include: { approvalSteps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Routing decision not found');
    return this.toDto(row);
  }

  private toDto(row: RoutingDecisionRow): RoutingDecision {
    return {
      id: row.id,
      requestId: row.requestId,
      requesterId: row.requesterId,
      requestTypeId: row.requestTypeId,
      status: row.status as RoutingDecision['status'],
      destinationQueue: row.destinationQueue,
      submittedAt: row.createdAt.toISOString(),
      approvalSteps: row.approvalSteps.map((step) => ({
        id: step.id,
        stepNumber: step.stepNumber,
        approverId: step.approverId,
        status: step.status as RoutingDecision['approvalSteps'][number]['status'],
        decidedBy: step.decidedBy ?? undefined,
        decidedAt: step.decidedAt ? step.decidedAt.toISOString() : undefined,
        rejectionReason: step.rejectionReason ?? undefined,
      })),
    };
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
}
