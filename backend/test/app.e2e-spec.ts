import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

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
        idempotencyKey: 'e2e-request-1',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.replayed).toBe(false);
        expect(body.request.status).toBe('Submitted');
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

  afterEach(async () => {
    await app.close();
  });
});
