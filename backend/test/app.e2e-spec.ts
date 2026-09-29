import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    // Clean database before each test
    await prisma.fulfillmentComment.deleteMany();
    await prisma.queueAssignment.deleteMany();
    await prisma.approvalStepInstance.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.request.deleteMany();
    await prisma.requestTypeVersion.deleteMany();
    await prisma.requestType.deleteMany();

    // Re-seed required request types
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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  const submitNewLaptop = async (requesterId: string, idempotencyKey: string) => {
    const response = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', requesterId)
      .send({
        requesterId,
        requestTypeId: 'new-laptop',
        description: 'Routing decision e2e fixture request.',
        formData: {},
        idempotencyKey,
      })
      .expect(201);
    return response.body.request.id as string;
  };

  const findQueueItem = async (approverId: string, requestId: string) => {
    const queue = await request(app.getHttpServer())
      .get('/routing-decisions/queue')
      .set('x-actor-id', approverId)
      .expect(200);
    return queue.body.find((item: { requestId: string }) => item.requestId === requestId);
  };

  it('approves a pending approval step', async () => {
    const requestId = await submitNewLaptop('employee-1', `approve-step-${Date.now()}`);
    const item = await findQueueItem('manager-1', requestId);
    expect(item).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`)
      .set('x-actor-id', 'manager-1')
      .send({ decision: 'approve' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('ReadyForQueue');
        expect(body.approvalSteps[0].status).toBe('Approved');
      });
  });

  it('rejects a decision from the wrong approver', async () => {
    const requestId = await submitNewLaptop('employee-1', `wrong-approver-${Date.now()}`);
    const item = await findQueueItem('manager-1', requestId);

    return request(app.getHttpServer())
      .post(`/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`)
      .set('x-actor-id', 'employee-1')
      .send({ decision: 'approve' })
      .expect(403);
  });

  it('rejects a decision from an actor unknown to the directory', () => {
    return request(app.getHttpServer())
      .post('/routing-decisions/anything/steps/anything/decision')
      .set('x-actor-id', 'someone-not-in-the-directory')
      .send({ decision: 'approve' })
      .expect(401);
  });

  it('requires a reason for rejection', async () => {
    const requestId = await submitNewLaptop('employee-1', `needs-reason-${Date.now()}`);
    const item = await findQueueItem('manager-1', requestId);

    return request(app.getHttpServer())
      .post(`/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`)
      .set('x-actor-id', 'manager-1')
      .send({ decision: 'reject' })
      .expect(400);
  });

  it('supports a sequential multi-step approval chain (manager, then department head)', async () => {
    const requestTypeId = `e2e-multistep-${Date.now()}`;
    await request(app.getHttpServer())
      .put(`/admin/config/request-types/${requestTypeId}`)
      .set('x-actor-id', 'admin-1')
      .send({
        name: 'E2E multi-step type',
        department: 'IT',
        schema: { fields: [], required: [] },
        routingMode: 'approval',
        destinationQueue: 'IT',
        approvalChain: [{ type: 'manager' }, { type: 'department-head' }],
      })
      .expect(200);

    const submission = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-1')
      .send({
        requesterId: 'employee-1',
        requestTypeId,
        description: 'Multi-step approval e2e request.',
        formData: {},
        idempotencyKey: `multistep-${Date.now()}`,
      })
      .expect(201);
    const requestId = submission.body.request.id;

    const deptHeadQueueBefore = await request(app.getHttpServer())
      .get('/routing-decisions/queue')
      .set('x-actor-id', 'depthead-it')
      .expect(200);
    expect(deptHeadQueueBefore.body.some((item: { requestId: string }) => item.requestId === requestId)).toBe(false);

    const step1 = await findQueueItem('manager-1', requestId);
    await request(app.getHttpServer())
      .post(`/routing-decisions/${step1.decisionId}/steps/${step1.stepId}/decision`)
      .set('x-actor-id', 'manager-1')
      .send({ decision: 'approve' })
      .expect(201);

    const step2 = await findQueueItem('depthead-it', requestId);
    expect(step2).toBeTruthy();

    const final = await request(app.getHttpServer())
      .post(`/routing-decisions/${step2.decisionId}/steps/${step2.stepId}/decision`)
      .set('x-actor-id', 'depthead-it')
      .send({ decision: 'approve' })
      .expect(201);
    expect(final.body.status).toBe('ReadyForQueue');

    const audit = await request(app.getHttpServer())
      .get(`/requests/${requestId}/audit`)
      .set('x-actor-id', 'employee-1')
      .expect(200);
    expect(
      audit.body.routingDecision.approvalSteps.map((step: { approverId: string; status: string }) => ({
        approverId: step.approverId,
        status: step.status,
      })),
    ).toEqual([
      { approverId: 'manager-1', status: 'Approved' },
      { approverId: 'depthead-it', status: 'Approved' },
    ]);
  });

  it('exposes the rejection reason through the shared audit endpoint, scoped by viewer', async () => {
    const requestId = await submitNewLaptop('employee-1', `audit-reject-${Date.now()}`);
    const item = await findQueueItem('manager-1', requestId);

    await request(app.getHttpServer())
      .post(`/routing-decisions/${item.decisionId}/steps/${item.stepId}/decision`)
      .set('x-actor-id', 'manager-1')
      .send({ decision: 'reject', reason: 'Not approved this quarter' })
      .expect(201);

    const asRequester = await request(app.getHttpServer())
      .get(`/requests/${requestId}/audit`)
      .set('x-actor-id', 'employee-1')
      .expect(200);
    expect(asRequester.body.routingDecision.approvalSteps[0].rejectionReason).toBe('Not approved this quarter');
    expect(asRequester.body.status).toBe('Rejected');

    await request(app.getHttpServer())
      .get(`/requests/${requestId}/audit`)
      .set('x-actor-id', 'employee-2')
      .expect(403);

    const asAdmin = await request(app.getHttpServer())
      .get(`/requests/${requestId}/audit`)
      .set('x-actor-id', 'admin-1')
      .expect(200);
    expect(asAdmin.body.status).toBe('Rejected');
  });

  it('creates and persists a service request through the HTTP contract', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-1')
      .send({
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'My laptop needs replacement for current work.',
        formData: {},
        idempotencyKey: `e2e-request-${Date.now()}`,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.replayed).toBe(false);
        expect(body.request.status).toBe('Pending Approval');
        expect(body.request.formData.department).toBe('IT');
        expect(body.request.statusEvents[0].status).toBe('Submitted');
      });
  });

  it('lists only the acting employee\'s own requests, newest first', async () => {
    const first = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-1')
      .send({
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'First request for the my-requests listing test.',
        formData: {},
        idempotencyKey: `mine-first-${Date.now()}`,
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-1')
      .send({
        requesterId: 'employee-1',
        requestTypeId: 'desk-relocation',
        description: 'Second request for the my-requests listing test.',
        formData: { newLocation: '4th floor' },
        idempotencyKey: `mine-second-${Date.now()}`,
      })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/requests/mine')
      .set('x-actor-id', 'employee-1')
      .expect(200);

    const ids = mine.body.map((item: { id: string }) => item.id);
    expect(ids.indexOf(second.body.request.id)).toBeLessThan(ids.indexOf(first.body.request.id));

    const listed = mine.body.find((item: { id: string }) => item.id === second.body.request.id);
    expect(listed).toMatchObject({
      requestTypeName: 'Desk relocation',
      department: 'Operations',
      status: 'In Progress',
    });
    expect(listed.statusEvents.map((event: { status: string }) => event.status)).toEqual([
      'Submitted',
      'In Progress',
    ]);

    const someoneElse = await request(app.getHttpServer())
      .get('/requests/mine')
      .set('x-actor-id', 'employee-2')
      .expect(200);
    expect(someoneElse.body.some((item: { id: string }) => item.id === second.body.request.id)).toBe(false);
  });

  it('denies a request when the actor is not the requester', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-2')
      .send({
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'This identity should not submit for another employee.',
        formData: {},
      })
      .expect(403);
  });

  it('denies a request from an actor unknown to the directory', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'someone-not-in-the-directory')
      .send({
        requesterId: 'someone-not-in-the-directory',
        requestTypeId: 'new-laptop',
        description: 'This identity is not in the mock org chart at all.',
        formData: {},
      })
      .expect(401);
  });

  it('hands a submitted request to the routing queue and persists approval', async () => {
    const requestIdempotencyKey = `linked-flow-${Date.now()}`;
    const submission = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-1')
      .send({
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'This request should appear in routing for approval.',
        formData: {},
        idempotencyKey: requestIdempotencyKey,
      })
      .expect(201);

    expect(submission.body.request.status).toBe('Pending Approval');
    expect(submission.body.request.statusEvents.map((event: { status: string }) => event.status)).toEqual([
      'Submitted',
      'Pending Approval',
    ]);

    const queue = await request(app.getHttpServer())
      .get('/routing-decisions/queue')
      .set('x-actor-id', 'manager-1')
      .expect(200);
    const queueItem = queue.body.find(
      (item: { requestId: string }) => item.requestId === submission.body.request.id,
    );

    expect(queueItem).toMatchObject({
      requestId: submission.body.request.id,
      status: 'Pending',
    });

    await request(app.getHttpServer())
      .post(`/routing-decisions/${queueItem.decisionId}/steps/${queueItem.stepId}/decision`)
      .set('x-actor-id', 'manager-1')
      .send({ decision: 'approve' })
      .expect(201);

    const stored = await app.get(PrismaService).request.findUnique({
      where: { id: submission.body.request.id },
      include: { statusEvents: true, queueAssignment: true },
    });

    expect(stored?.status).toBe('In Progress');
    expect(stored?.statusEvents.map((event: { status: string }) => event.status)).toEqual([
      'Submitted',
      'Pending Approval',
      'Approved',
      'In Progress',
    ]);
    expect(stored?.queueAssignment?.queue).toBe('IT');

    const fulfillmentQueue = await request(app.getHttpServer())
      .get('/fulfillment/queue')
      .set('x-actor-id', 'fulfiller-it-1')
      .expect(200);
    expect(
      fulfillmentQueue.body.some(
        (item: { requestId: string }) => item.requestId === submission.body.request.id,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/fulfillment/${submission.body.request.id}/resolve`)
      .set('x-actor-id', 'fulfiller-it-1')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/fulfillment/${submission.body.request.id}/close`)
      .set('x-actor-id', 'fulfiller-it-1')
      .expect(201);

    const closed = await prisma.request.findUnique({
      where: { id: submission.body.request.id },
    });
    expect(closed?.status).toBe('Closed');
  });

  afterEach(async () => {
    await app.close();
  });
});
