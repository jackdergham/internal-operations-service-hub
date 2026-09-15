import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RoutingService } from './routing.service.js';

describe('RoutingService', () => {
  it('approves a pending step for its designated approver', async () => {
    const service = new RoutingService();

    const result = await service.decideApproval('decision-1', 'step-1', {
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

  it('rejects a pending step and preserves the rejection reason', async () => {
    const service = new RoutingService();

    const result = await service.decideApproval('decision-1', 'step-1', {
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

  it('rejects a decision from anyone other than the designated approver', async () => {
    const service = new RoutingService();

    await expect(
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'another-actor',
        decision: 'approve',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a reason when rejecting', async () => {
    const service = new RoutingService();

    await expect(
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'manager-1',
        decision: 'reject',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a second decision for the same step', async () => {
    const service = new RoutingService();

    await service.decideApproval('decision-1', 'step-1', {
      approverId: 'manager-1',
      decision: 'approve',
    });

    await expect(
      service.decideApproval('decision-1', 'step-1', {
        approverId: 'manager-1',
        decision: 'reject',
        reason: 'Too late',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('routes employee-2 requests to manager-2', async () => {
    const service = new RoutingService();

    await service.registerRequest({
      id: 'request-2',
      requesterId: 'employee-2',
      requestTypeId: 'new-laptop',
      createdAt: new Date(),
    });

    expect(service.listQueue('manager-1')).toHaveLength(1);
    expect(service.listQueue('manager-2')).toMatchObject([
      { requesterId: 'employee-2', approverId: 'manager-2' },
    ]);

    await expect(
      service.decideApproval('decision-request-2', 'step-request-2', {
        approverId: 'manager-1',
        decision: 'approve',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
