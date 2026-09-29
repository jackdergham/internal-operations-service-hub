import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { RoutingService } from '../routing/routing.service.js';
import { FulfillmentService } from '../fulfillment/fulfillment.service.js';
import { AuditService } from './audit.service.js';

describe('AuditService database integration', () => {
  let prisma: PrismaService;
  let directoryService: DirectoryService;
  let routingService: RoutingService;
  let fulfillmentService: FulfillmentService;
  let auditService: AuditService;

  const requester = () => directoryService.mustFind('employee-1');
  const otherRequester = () => directoryService.mustFind('employee-2');
  const admin = () => directoryService.mustFind('admin-1');
  const itFulfiller = () => directoryService.mustFind('fulfiller-it-1');
  const hrFulfiller = () => directoryService.mustFind('fulfiller-hr-1');
  const approver = () => directoryService.mustFind('manager-1');

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    directoryService = new DirectoryService();
    fulfillmentService = new FulfillmentService(prisma);
    routingService = new RoutingService(prisma, directoryService, fulfillmentService);
    auditService = new AuditService(prisma);

    await prisma.fulfillmentComment.deleteMany();
    await prisma.queueAssignment.deleteMany();
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createRequest = async (requesterId: string) => {
    const id = `REQ-AUDIT-${randomUUID().slice(0, 8)}`;
    await prisma.request.create({
      data: {
        id, requesterId, requestTypeId: 'new-laptop',
        description: 'Audit integration test request.', formData: {}, status: 'Submitted',
        statusEvents: { create: { id: randomUUID(), status: 'Submitted', source: 'intake' } },
      },
    });
    return id;
  };

  it('returns null routingDecision for a request that has not been routed yet', async () => {
    const id = await createRequest('employee-1');
    const audit = await auditService.getRequestAudit(id, requester());
    expect(audit.routingDecision).toBeNull();
    expect(audit.statusEvents).toEqual([{ status: 'Submitted', source: 'intake', createdAt: expect.any(String) }]);
  });

  it('throws NotFoundException for a request that does not exist', async () => {
    await expect(auditService.getRequestAudit('REQ-NOPE', admin())).rejects.toThrow(NotFoundException);
  });

  it('lets the requester see their own request, including the rejection reason', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, {
      approverId: 'manager-1', decision: 'reject', reason: 'Duplicate request',
    });

    const audit = await auditService.getRequestAudit(id, requester());
    expect(audit.status).toBe('Rejected');
    expect(audit.routingDecision?.approvalSteps[0]).toMatchObject({
      status: 'Rejected', decidedBy: 'manager-1', rejectionReason: 'Duplicate request',
    });
  });

  it('denies a different requester with no other role', async () => {
    const id = await createRequest('employee-1');
    await expect(auditService.getRequestAudit(id, otherRequester())).rejects.toThrow(ForbiddenException);
  });

  it('lets an admin see any request, including internal comments', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });
    await fulfillmentService.addComment(id, itFulfiller(), { body: 'Ordered from vendor.', visibility: 'internal' });
    await fulfillmentService.addComment(id, itFulfiller(), { body: 'Delivery expected Friday.', visibility: 'requester-visible' });

    const audit = await auditService.getRequestAudit(id, admin());
    expect(audit.comments).toHaveLength(2);
    expect(audit.comments.map((c) => c.body)).toEqual(['Ordered from vendor.', 'Delivery expected Friday.']);
  });

  it('lets the requester see requester-visible comments but not internal ones', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });
    await fulfillmentService.addComment(id, itFulfiller(), { body: 'Internal note only.', visibility: 'internal' });
    await fulfillmentService.addComment(id, itFulfiller(), { body: 'Visible to you.', visibility: 'requester-visible' });

    const audit = await auditService.getRequestAudit(id, requester());
    expect(audit.comments).toHaveLength(1);
    expect(audit.comments[0].body).toBe('Visible to you.');
  });

  it('lets the assigned fulfiller see internal comments', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });
    await fulfillmentService.assignToSelf(id, itFulfiller());
    await fulfillmentService.addComment(id, itFulfiller(), { body: 'Internal note.', visibility: 'internal' });

    const audit = await auditService.getRequestAudit(id, itFulfiller());
    expect(audit.comments).toHaveLength(1);
  });

  it('lets any fulfiller in the same queue department see it, even if not personally assigned', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });

    const audit = await auditService.getRequestAudit(id, itFulfiller());
    expect(audit.requestId).toBe(id);
  });

  it('denies a fulfiller from a different department', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });
    const decision = await routingService.findDecisionForRequest(id);
    await routingService.decideApproval(decision!.id, decision!.approvalSteps[0].id, { approverId: 'manager-1', decision: 'approve' });

    await expect(auditService.getRequestAudit(id, hrFulfiller())).rejects.toThrow(ForbiddenException);
  });

  it('lets a designated approver see the request they were asked to decide', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });

    const audit = await auditService.getRequestAudit(id, approver());
    expect(audit.routingDecision?.approvalSteps[0].approverId).toBe('manager-1');
  });

  it('denies an approver who was never on this request\'s chain', async () => {
    const id = await createRequest('employee-2');
    await routingService.registerRequest({ id, requesterId: 'employee-2', requestTypeId: 'new-laptop', createdAt: new Date() });

    await expect(auditService.getRequestAudit(id, approver())).rejects.toThrow(ForbiddenException);
  });

  it('returns status events in chronological order regardless of write order', async () => {
    const id = await createRequest('employee-1');
    await routingService.registerRequest({ id, requesterId: 'employee-1', requestTypeId: 'new-laptop', createdAt: new Date() });

    const audit = await auditService.getRequestAudit(id, requester());
    const timestamps = audit.statusEvents.map((event) => new Date(event.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });
});
