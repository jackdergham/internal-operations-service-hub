import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import type { Actor } from '../directory/directory.types.js';
import type { AddCommentInput, QueueItem } from './fulfillment.types.js';

const ACTIONABLE_ROLES = ['fulfiller', 'admin'] as const;

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called once a request's RoutingDecision reaches ReadyForQueue (approved,
   * or direct-routed). Idempotent: safe to call more than once for the same
   * request, e.g. on server restart replaying persisted state.
   */
  async registerReadyForQueue(request: { id: string; queue: string }): Promise<void> {
    const existing = await this.prisma.queueAssignment.findUnique({
      where: { requestId: request.id },
    });
    if (existing) return;

    await this.prisma.$transaction([
      this.prisma.queueAssignment.create({
        data: { id: randomUUID(), requestId: request.id, queue: request.queue },
      }),
      this.prisma.request.update({ where: { id: request.id }, data: { status: 'In Progress' } }),
      this.prisma.statusEvent.create({
        data: {
          id: randomUUID(),
          requestId: request.id,
          status: 'In Progress',
          source: 'fulfillment',
        },
      }),
    ]);
  }

  async listQueue(actor: Actor): Promise<QueueItem[]> {
    this.requireActionableRole(actor);

    const assignments = await this.prisma.queueAssignment.findMany({
      where: actor.roles.includes('admin') ? {} : { queue: actor.department },
      include: { request: true },
      orderBy: { createdAt: 'asc' },
    });

    return assignments.map((assignment: (typeof assignments)[number]) => ({
      requestId: assignment.requestId,
      requesterId: assignment.request.requesterId,
      requestTypeId: assignment.request.requestTypeId,
      description: assignment.request.description,
      status: assignment.request.status,
      queue: assignment.queue,
      assignedFulfillerId: assignment.assignedFulfillerId,
      createdAt: assignment.createdAt.toISOString(),
    }));
  }

  async assignToSelf(requestId: string, actor: Actor): Promise<void> {
    this.requireActionableRole(actor);
    const assignment = await this.mustFindAssignment(requestId);
    await this.prisma.queueAssignment.update({
      where: { id: assignment.id },
      data: { assignedFulfillerId: actor.employeeId },
    });
  }

  async reassign(requestId: string, actor: Actor, newQueue: string): Promise<void> {
    if (!actor.roles.includes('admin')) {
      throw new ForbiddenException('Only an admin may reassign a request to a different queue');
    }
    if (!newQueue || newQueue.trim().length === 0) {
      throw new BadRequestException('queue is required');
    }

    const assignment = await this.mustFindAssignment(requestId);
    await this.prisma.queueAssignment.update({
      where: { id: assignment.id },
      data: { queue: newQueue },
    });
  }

  async addComment(requestId: string, actor: Actor, input: AddCommentInput): Promise<void> {
    this.requireActionableRole(actor);
    if (!input?.body || input.body.trim().length === 0) {
      throw new BadRequestException('body is required');
    }
    await this.mustFindAssignment(requestId);

    await this.prisma.fulfillmentComment.create({
      data: {
        id: randomUUID(),
        requestId,
        authorId: actor.employeeId,
        body: input.body.trim(),
        visibility: input.visibility ?? 'internal',
      },
    });
  }

  async resolve(requestId: string, actor: Actor): Promise<void> {
    this.requireActionableRole(actor);
    const request = await this.mustFindRequestForAssignment(requestId);

    if (request.status !== 'In Progress') {
      throw new ConflictException('Only a request that is In Progress can be resolved');
    }

    await this.transitionStatus(requestId, 'Resolved');
  }

  async close(requestId: string, actor: Actor): Promise<void> {
    this.requireActionableRole(actor);
    const request = await this.mustFindRequestForAssignment(requestId);

    if (request.status !== 'Resolved') {
      throw new ConflictException('Only a request that is Resolved can be closed');
    }

    await this.transitionStatus(requestId, 'Closed');
  }

  private async transitionStatus(requestId: string, status: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.request.update({ where: { id: requestId }, data: { status } }),
      this.prisma.statusEvent.create({
        data: { id: randomUUID(), requestId, status, source: 'fulfillment' },
      }),
    ]);
  }

  private requireActionableRole(actor: Actor): void {
    const isActionable = ACTIONABLE_ROLES.some((role) => actor.roles.includes(role));
    if (!isActionable) {
      throw new ForbiddenException('Only a fulfiller or admin may act on fulfillment items');
    }
  }

  private async mustFindAssignment(requestId: string) {
    const assignment = await this.prisma.queueAssignment.findUnique({ where: { requestId } });
    if (!assignment) throw new NotFoundException('No queue assignment for this request');
    return assignment;
  }

  private async mustFindRequestForAssignment(requestId: string) {
    await this.mustFindAssignment(requestId);
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }
}
