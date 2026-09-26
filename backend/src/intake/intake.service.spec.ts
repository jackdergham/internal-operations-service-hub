import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { IntakeService } from './intake.service.js';

describe('IntakeService database integration', () => {
  let prisma: PrismaService;
  let service: IntakeService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new IntakeService(prisma, new DirectoryService());
    await prisma.statusEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.request.deleteMany();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists an authorized request and its initial status event', async () => {
    const result = await service.createRequest('employee-1', {
      requesterId: 'employee-1',
      requestTypeId: 'new-laptop',
      description: 'My laptop cannot run the required development tools.',
      formData: {},
      attachments: [
        {
          filename: 'device-photo.png',
          size: 2048,
          contentType: 'image/png',
          storageReference: 'uploads/device-photo.png',
        },
      ],
      idempotencyKey: 'test-request-1',
    });

    const stored = await prisma.request.findUnique({
      where: { id: result.request.id },
      include: { attachments: true, statusEvents: true },
    });

    expect(result.replayed).toBe(false);
    expect(stored).toMatchObject({
      requesterId: 'employee-1',
      status: 'Submitted',
      description: 'My laptop cannot run the required development tools.',
      formData: { department: 'IT' },
    });
    expect(stored?.attachments).toHaveLength(1);
    expect(stored?.statusEvents).toHaveLength(1);
    expect(stored?.statusEvents[0].status).toBe('Submitted');
  });

  it('denies a requester identity mismatch', async () => {
    await expect(
      service.createRequest('employee-2', {
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'This should not be accepted as another employee.',
        formData: {},
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a deliberately invalid submission', async () => {
    await expect(
      service.createRequest('employee-1', {
        requesterId: 'employee-1',
        requestTypeId: 'new-laptop',
        description: 'Too short',
        formData: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('replays an idempotent retry instead of creating a duplicate', async () => {
    const input = {
      requesterId: 'employee-1',
      requestTypeId: 'new-laptop',
      description: 'A request that can be retried safely.',
      formData: {},
      idempotencyKey: 'test-retry-1',
    };

    const first = await service.createRequest('employee-1', input);
    const second = await service.createRequest('employee-1', input);

    expect(first.request.id).toBe(second.request.id);
    expect(second.replayed).toBe(true);
    expect(await prisma.request.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });
});
