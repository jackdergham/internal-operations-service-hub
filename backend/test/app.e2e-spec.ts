import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('approves a pending approval step', () => {
    return request(app.getHttpServer())
      .post('/routing-decisions/decision-1/steps/step-1/decision')
      .send({ approverId: 'manager-1', decision: 'approve' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('ReadyForQueue');
        expect(body.approvalSteps[0].status).toBe('Approved');
      });
  });

  it('rejects a decision from the wrong approver', () => {
    return request(app.getHttpServer())
      .post('/routing-decisions/decision-1/steps/step-1/decision')
      .send({ approverId: 'another-actor', decision: 'approve' })
      .expect(403);
  });

  it('requires a reason for rejection', () => {
    return request(app.getHttpServer())
      .post('/routing-decisions/decision-1/steps/step-1/decision')
      .send({ approverId: 'manager-1', decision: 'reject' })
      .expect(400);
  });

  it('creates and persists a service request through the HTTP contract', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'employee-e2e')
      .send({
        requesterId: 'employee-e2e',
        requestTypeId: 'new-laptop',
        description: 'My laptop needs replacement for current work.',
        formData: { department: 'Engineering' },
        idempotencyKey: `e2e-request-${Date.now()}`,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.replayed).toBe(false);
        expect(body.request.status).toBe('Pending Approval');
        expect(body.request.statusEvents[0].status).toBe('Submitted');
      });
  });

  it('denies a request when the actor is not the requester', () => {
    return request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'different-employee')
      .send({
        requesterId: 'employee-e2e',
        requestTypeId: 'new-laptop',
        description: 'This identity should not submit for another employee.',
        formData: { department: 'Engineering' },
      })
      .expect(403);
  });

  it('hands a submitted request to the routing queue and persists approval', async () => {
    const requestIdempotencyKey = `linked-flow-${Date.now()}`;
    const submission = await request(app.getHttpServer())
      .post('/requests')
      .set('x-actor-id', 'linked-flow-employee')
      .send({
        requesterId: 'linked-flow-employee',
        requestTypeId: 'new-laptop',
        description: 'This request should appear in routing for approval.',
        formData: { department: 'Engineering' },
        idempotencyKey: requestIdempotencyKey,
      })
      .expect(201);

    expect(submission.body.request.status).toBe('Pending Approval');
    expect(submission.body.request.statusEvents.map((event: { status: string }) => event.status)).toEqual([
      'Submitted',
      'Pending Approval',
    ]);

    const queue = await request(app.getHttpServer())
      .get('/routing-decisions/queue?approverId=manager-1')
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
      .send({ approverId: 'manager-1', decision: 'approve' })
      .expect(201);

    const stored = await app.get(PrismaService).request.findUnique({
      where: { id: submission.body.request.id },
      include: { statusEvents: true },
    });

    expect(stored?.status).toBe('Approved');
    expect(stored?.statusEvents.at(-1)?.status).toBe('Approved');
  });

  afterEach(async () => {
    await app.close();
  });
});
