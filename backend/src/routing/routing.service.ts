import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  DecideApprovalInput,
  RoutingDecision,
} from './routing.types.js';

@Injectable()
export class RoutingService {
  private readonly decisions = new Map<string, RoutingDecision>([
    [
      'decision-1',
      {
        id: 'decision-1',
        requestId: 'request-1',
        status: 'AwaitingApproval',
        destinationQueue: 'it-support',
        approvalSteps: [
          {
            id: 'step-1',
            stepNumber: 1,
            approverId: 'manager-1',
            status: 'Pending',
          },
        ],
      },
    ],
  ]);

  decideApproval(
    decisionId: string,
    stepId: string,
    input: DecideApprovalInput,
  ): RoutingDecision {
    const routingDecision = this.decisions.get(decisionId);

    if (!routingDecision) {
      throw new NotFoundException('Routing decision not found');
    }

    const step = routingDecision.approvalSteps.find(({ id }) => id === stepId);

    if (!step) {
      throw new NotFoundException('Approval step not found');
    }

    this.validateInput(input);

    if (step.status !== 'Pending') {
      throw new ConflictException('Approval step has already been decided');
    }

    if (step.approverId !== input.approverId) {
      throw new ForbiddenException('Only the designated approver may decide this step');
    }

    step.status = input.decision === 'approve' ? 'Approved' : 'Rejected';
    step.decidedBy = input.approverId;
    step.decidedAt = new Date().toISOString();

    if (input.decision === 'reject') {
      step.rejectionReason = input.reason;
      routingDecision.status = 'Rejected';
    } else {
      routingDecision.status = 'ReadyForQueue';
    }

    return this.cloneDecision(routingDecision);
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
    return {
      ...decision,
      approvalSteps: decision.approvalSteps.map((step) => ({ ...step })),
    };
  }
}
