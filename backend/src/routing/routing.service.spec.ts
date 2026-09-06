import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RoutingService } from './routing.service.js';

describe('RoutingService', () => {
  it('approves a pending step for its designated approver', () => {
    const service = new RoutingService();

    const result = service.decideApproval('decision-1', 'step-1', {
      approverId: 'manager-1',
      decision: 'approve',
    });

    expect(result.status).toBe('ReadyForQueue');
    expect(result.approvalSteps[0]).toMatchObject({
      status: 'Approved',
      decidedBy: 'manager-1',
    });
    expect(result.approvalSteps[0].decidedAt).toEqual(expect.any(String));
  });

  it('rejects a pending step and preserves the rejection reason', () => {
    const service = new RoutingService();

    const result = service.decideApproval('decision-1', 'step-1', {
      approverId: 'manager-1',
      decision: 'reject',
      reason: 'Budget is not available',
    });

    expect(result.status).toBe('Rejected');
    expect(result.approvalSteps[0]).toMatchObject({
      status: 'Rejected',
      rejectionReason: 'Budget is not available',
    });
  });

  it('rejects a decision from anyone other than the designated approver', () => {
    const service = new RoutingService();

    expect(() =>
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'another-actor',
        decision: 'approve',
      }),
    ).toThrow(ForbiddenException);
  });

  it('requires a reason when rejecting', () => {
    const service = new RoutingService();

    expect(() =>
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'manager-1',
        decision: 'reject',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a second decision for the same step', () => {
    const service = new RoutingService();

    service.decideApproval('decision-1', 'step-1', {
      approverId: 'manager-1',
      decision: 'approve',
    });

    expect(() =>
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'manager-1',
        decision: 'reject',
        reason: 'Too late',
      }),
    ).toThrow(ConflictException);
  });
});
