import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { RoutingService } from './routing.service.js';

describe('RoutingService database integration', () => {
  let prisma: PrismaService;
  let directoryService: DirectoryService;
  let service: RoutingService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    directoryService = new DirectoryService();
    service = new RoutingService(prisma, directoryService);

    await prisma.approvalStepInstance.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.request.deleteMany();

    await prisma.requestType.upsert({
      where: { id: 'new-laptop' },
      update: { routingMode: 'approval', destinationQueue: 'IT', approvalChain: [{ type: 'manager' }] },
      create: {
        id: 'new-laptop', name: 'New laptop / equipment', department: 'IT',
        schema: { required: [], fields: [] }, routingMode: 'approval',
        destinationQueue: 'IT', approvalChain: [{ type: 'manager' }],
      },
    });
    await prisma.requestType.upsert({
      where: { id: 'pto-request' },
      update: { routingMode: 'approval', destinationQueue: 'HR', approvalChain: [{ type: 'manager' }, { type: 'department-head' }] },
      create: {
        id: 'pto-request', name: 'PTO / annual leave', department: 'HR',
        schema: { required: [], fields: [] }, routingMode: 'approval',
        destinationQueue: 'HR', approvalChain: [{ type: 'manager' }, { type: 'department-head' }],
      },
    });
    await prisma.requestType.upsert({
      where: { id: 'desk-relocation' },
      update: { routingMode: 'direct', destinationQueue: 'Operations', approvalChain: [] },
      create: {
        id: 'desk-relocation', name: 'Desk relocation', department: 'Operations',
        schema: { required: [], fields: [] }, routingMode: 'direct',
        destinationQueue: 'Operations', approvalChain: [],
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.approvalStepInstance.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.request.deleteMany();
  });

  const createRequest = async (requestTypeId: string, requesterId: string) => {
    const id = `REQ-ROUTING-${randomUUID().slice(0, 8)}`;
    await prisma.request.create({
      data: {
        id, requesterId, requestTypeId,
        description: 'Routing integration test request.', formData: {}, status: 'Submitted',
        statusEvents: { create: { id: randomUUID(), status: 'Submitted', source: 'intake' } },
      },
    });
    return id;
  };

  it('creates a single-step chain for a request type with one approver', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });

    const decision = await service.findDecisionForRequest(id);
    expect(decision?.status).toBe('AwaitingApproval');
    expect(decision?.approvalSteps).toHaveLength(1);
    expect(decision?.approvalSteps[0]).toMatchObject({ stepNumber: 1, approverId: 'manager-1', status: 'Pending' });

    const request = await prisma.request.findUniqueOrThrow({ where: { id } });
    expect(request.status).toBe('Pending Approval');
  });

  it('creates a sequential multi-step chain (manager, then department head) and advances one step at a time', async () => {
    const id = await createRequest('pto-request', 'employee-2');
    await service.registerRequest({ id, requesterId: 'employee-2', requestTypeId: 'pto-request', createdAt: new Date() });

    let decision = await service.findDecisionForRequest(id);
    expect(decision?.approvalSteps.map((s) => s.approverId)).toEqual(['manager-2', 'depthead-hr']);
    expect(decision?.approvalSteps[0].status).toBe('Pending');
    expect(decision?.approvalSteps[1].status).toBe('Blocked');

    await expect(
      service.decideApproval(decision!.id, decision!.approvalSteps[1].id, { approverId: 'depthead-hr', decision: 'approve' }),
    ).rejects.toThrow(ConflictException);

    await service.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-2', decision: 'approve' });
    decision = await service.findDecisionForRequest(id);
    expect(decision?.status).toBe('AwaitingApproval');
    expect(decision?.approvalSteps[0].status).toBe('Approved');
    expect(decision?.approvalSteps[0].decidedBy).toBe('manager-2');
    expect(decision?.approvalSteps[1].status).toBe('Pending');
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).status).toBe('Pending Approval');

    const final = await service.decideApproval(decision!.id, decision!.approvalSteps[1].id, { approverId: 'depthead-hr', decision: 'approve' });
    expect(final.status).toBe('ReadyForQueue');
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).status).toBe('Approved');
  });

  it('routes direct-mode request types straight to a queue with no approval steps', async () => {
    const id = await createRequest('desk-relocation', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'desk-relocation', createdAt: new Date() });

    const decision = await service.findDecisionForRequest(id);
    expect(decision?.status).toBe('ReadyForQueue');
    expect(decision?.approvalSteps).toHaveLength(0);
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).status).toBe('Submitted');
  });

  it('rejects a step, stores the reason, and stops the chain', async () => {
    const id = await createRequest('pto-request', 'employee-2');
    await service.registerRequest({ id, requesterId: 'employee-2', requestTypeId: 'pto-request', createdAt: new Date() });
    const decision = await service.findDecisionForRequest(id);

    const result = await service.decideApproval(decision!.id, decision!.approvalSteps[0].id, {
      approverId: 'manager-2', decision: 'reject', reason: 'Missing coverage plan',
    });
    expect(result.status).toBe('Rejected');
    expect(result.approvalSteps[0]).toMatchObject({ status: 'Rejected', rejectionReason: 'Missing coverage plan' });
    expect(result.approvalSteps[1].status).toBe('Blocked');
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).status).toBe('Rejected');
  });

  it('requires a reason to reject', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await service.findDecisionForRequest(id);

    await expect(
      service.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'reject' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('only the designated approver may decide a step', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await service.findDecisionForRequest(id);

    await expect(
      service.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-2', decision: 'approve' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('a step already decided cannot be decided again', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await service.findDecisionForRequest(id);

    await service.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });
    await expect(
      service.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' }),
    ).rejects.toThrow(ConflictException);
  });

  it('a step id that does not belong to the given decision is not found', async () => {
    const a = await createRequest('new-laptop', 'employee-1');
    const b = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id: a, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    await service.registerRequest({ id: b, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decisionA = await service.findDecisionForRequest(a);
    const decisionB = await service.findDecisionForRequest(b);

    await expect(
      service.decideApproval(decisionA!.id, decisionB!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registerRequest is idempotent: calling it twice does not create a second decision', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    await service.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });

    expect(await prisma.routingDecision.count({ where: { requestId: id } })).toBe(1);
  });

  it('lists only the steps pending for the given approver, across multiple decisions', async () => {
    const forManager1 = await createRequest('new-laptop', 'employee-1');
    await service.registerRequest({ id: forManager1, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const forManager2 = await createRequest('pto-request', 'employee-2');
    await service.registerRequest({ id: forManager2, requesterId: 'employee-2', requestTypeId: 'pto-request', createdAt: new Date() });

    const manager1Queue = await service.listQueue('manager-1');
    const manager2Queue = await service.listQueue('manager-2');
    expect(manager1Queue.some((item) => item.requestId === forManager1)).toBe(true);
    expect(manager1Queue.some((item) => item.requestId === forManager2)).toBe(false);
    expect(manager2Queue.some((item) => item.requestId === forManager2)).toBe(true);
  });

  it('onModuleInit backfills a decision for a request seeded directly as Pending Approval, and never touches it again', async () => {
    const id = `REQ-SEEDLIKE-${randomUUID().slice(0, 8)}`;
    await prisma.request.create({
      data: { id, requesterId: 'employee-1', requestTypeId: 'new-laptop', description: 'Seed-like request.', formData: {}, status: 'Pending Approval' },
    });
    expect(await prisma.routingDecision.findUnique({ where: { requestId: id } })).toBeNull();

    await service.onModuleInit();
    const backfilled = await service.findDecisionForRequest(id);
    expect(backfilled?.status).toBe('AwaitingApproval');
    expect(backfilled?.approvalSteps[0].status).toBe('Pending');

    await service.decideApproval(backfilled!.id, backfilled!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });
    await service.onModuleInit();
    const afterSecondBoot = await service.findDecisionForRequest(id);
    expect(afterSecondBoot?.status).toBe('ReadyForQueue');
    expect(afterSecondBoot?.approvalSteps[0].status).toBe('Approved');
  });

  it('findDecisionForRequest returns null when no decision exists yet', async () => {
    const id = await createRequest('new-laptop', 'employee-1');
    expect(await service.findDecisionForRequest(id)).toBeNull();
  });
});
