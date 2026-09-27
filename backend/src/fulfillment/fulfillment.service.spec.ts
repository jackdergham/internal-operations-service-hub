import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { FulfillmentService } from './fulfillment.service.js';

describe('FulfillmentService database integration', () => {
  let prisma: PrismaService;
  let directoryService: DirectoryService;
  let service: FulfillmentService;
  let requestId: string;

  const fulfiller = () => directoryService.mustFind('fulfiller-it-1');
  const admin = () => directoryService.mustFind('admin-1');
  const requester = () => directoryService.mustFind('employee-1');

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    directoryService = new DirectoryService();
    service = new FulfillmentService(prisma);

    await prisma.fulfillmentComment.deleteMany();
    await prisma.queueAssignment.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.request.deleteMany();

    await prisma.requestType.upsert({
      where: { id: 'new-laptop' },
      update: {},
      create: {
        id: 'new-laptop',
        name: 'New laptop / equipment',
        department: 'IT',
        schema: { required: [], fields: [] },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    requestId = `REQ-FULFILLMENT-${randomUUID().slice(0, 8)}`;
    await prisma.request.create({
      data: {
        id: requestId,
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'A request ready for fulfillment testing.',
        formData: { department: 'IT' },
        status: 'Approved',
      },
    });
  });

  it('registers a queue assignment and moves the request to In Progress', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });

    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { queueAssignment: true, statusEvents: true },
    });

    expect(request.status).toBe('In Progress');
    expect(request.queueAssignment?.queue).toBe('IT');
    expect(request.statusEvents.at(-1)).toMatchObject({ status: 'In Progress', source: 'fulfillment' });
  });

  it('is idempotent: registering twice does not duplicate the assignment', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });

    expect(await prisma.queueAssignment.count({ where: { requestId } })).toBe(1);
  });

  it('only shows a fulfiller their own department queue', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });

    const hrFulfiller = directoryService.mustFind('fulfiller-hr-1');
    const itQueue = await service.listQueue(fulfiller());
    const hrQueue = await service.listQueue(hrFulfiller);

    expect(itQueue.some((item) => item.requestId === requestId)).toBe(true);
    expect(hrQueue.some((item) => item.requestId === requestId)).toBe(false);
  });

  it('lets an admin see every queue', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });
    const items = await service.listQueue(admin());
    expect(items.some((item) => item.requestId === requestId)).toBe(true);
  });

  it('denies a requester acting on the fulfillment queue', async () => {
    await expect(service.listQueue(requester())).rejects.toThrow(ForbiddenException);
  });

  it('only an admin may reassign a request to a different queue', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });

    await expect(service.reassign(requestId, fulfiller(), 'HR')).rejects.toThrow(ForbiddenException);

    await service.reassign(requestId, admin(), 'HR');
    const assignment = await prisma.queueAssignment.findUniqueOrThrow({ where: { requestId } });
    expect(assignment.queue).toBe('HR');
  });

  it('requires In Progress before resolving, and Resolved before closing', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });

    await service.resolve(requestId, fulfiller());
    let request = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(request.status).toBe('Resolved');

    await expect(service.resolve(requestId, fulfiller())).rejects.toThrow(ConflictException);

    await service.close(requestId, fulfiller());
    request = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(request.status).toBe('Closed');

    await expect(service.close(requestId, fulfiller())).rejects.toThrow(ConflictException);
  });

  it('rejects an action on a request with no queue assignment yet', async () => {
    await expect(service.resolve(requestId, fulfiller())).rejects.toThrow(NotFoundException);
  });

  it('logs a comment against the request', async () => {
    await service.registerReadyForQueue({ id: requestId, queue: 'IT' });
    await service.addComment(requestId, fulfiller(), { body: 'Ordered a replacement unit.' });

    const comments = await prisma.fulfillmentComment.findMany({ where: { requestId } });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ authorId: 'fulfiller-it-1', visibility: 'internal' });
  });
});
