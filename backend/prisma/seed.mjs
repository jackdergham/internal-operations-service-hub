import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const requestTypes = [
  {
    id: 'new-laptop',
    name: 'New laptop / equipment',
    department: 'IT',
    schema: {
      required: [],
      fields: [],
    },
  },
  {
    id: 'pto-request',
    name: 'PTO / annual leave',
    department: 'HR',
    schema: {
      required: ['startDate', 'endDate'],
      fields: [
        { key: 'startDate', label: 'Start date', type: 'date' },
        { key: 'endDate', label: 'End date', type: 'date' },
      ],
    },
  },
  {
    id: 'desk-relocation',
    name: 'Desk relocation',
    department: 'Operations',
    schema: {
      required: ['newLocation'],
      fields: [
        { key: 'newLocation', label: 'New location', type: 'text' },
      ],
    },
  },
];

const requests = [
  {
    id: 'REQ-SEED-001',
    requesterId: 'employee-1',
    requestTypeId: 'new-laptop',
    description: 'My current laptop cannot run the required development tools.',
    formData: { department: 'IT' },
    status: 'Pending Approval',
    idempotencyKey: 'seed-request-001',
    createdAt: new Date('2026-01-15T09:00:00.000Z'),
    events: [
      ['seed-event-001-submitted', 'Submitted', 'intake', '2026-01-15T09:00:00.000Z'],
      ['seed-event-001-pending', 'Pending Approval', 'routing', '2026-01-15T09:00:01.000Z'],
    ],
    attachment: {
      id: 'seed-attachment-001',
      filename: 'laptop-requirements.pdf',
      size: 24576,
      contentType: 'application/pdf',
      storageReference: 'seed/laptop-requirements.pdf',
    },
  },
  {
    id: 'REQ-SEED-002',
    requesterId: 'employee-2',
    requestTypeId: 'pto-request',
    description: 'I would like to take annual leave for a family holiday.',
    formData: { department: 'HR', startDate: '2026-02-02', endDate: '2026-02-06' },
    status: 'Approved',
    idempotencyKey: 'seed-request-002',
    createdAt: new Date('2026-01-10T11:30:00.000Z'),
    events: [
      ['seed-event-002-submitted', 'Submitted', 'intake', '2026-01-10T11:30:00.000Z'],
      ['seed-event-002-pending', 'Pending Approval', 'routing', '2026-01-10T11:30:01.000Z'],
      ['seed-event-002-approved', 'Approved', 'routing', '2026-01-11T08:15:00.000Z'],
    ],
  },
  {
    id: 'REQ-SEED-003',
    requesterId: 'employee-1',
    requestTypeId: 'desk-relocation',
    description: 'Please move my desk closer to the product team area.',
    formData: { department: 'Operations', newLocation: 'Building B, Floor 2' },
    status: 'Submitted',
    idempotencyKey: 'seed-request-003',
    createdAt: new Date('2026-01-20T14:00:00.000Z'),
    events: [['seed-event-003-submitted', 'Submitted', 'intake', '2026-01-20T14:00:00.000Z']],
  },
];

async function main() {
  for (const requestType of requestTypes) {
    await prisma.requestType.upsert({
      where: { id: requestType.id },
      update: requestType,
      create: requestType,
    });
  }

  for (const request of requests) {
    const { events, attachment, ...requestData } = request;

    await prisma.request.upsert({
      where: { id: request.id },
      update: requestData,
      create: requestData,
    });

    for (const [id, status, source, createdAt] of events) {
      await prisma.statusEvent.upsert({
        where: { id },
        update: { status, source, createdAt: new Date(createdAt) },
        create: { id, requestId: request.id, status, source, createdAt: new Date(createdAt) },
      });
    }

    if (attachment) {
      await prisma.attachment.upsert({
        where: { id: attachment.id },
        update: attachment,
        create: { ...attachment, requestId: request.id },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log(`Seeded ${requestTypes.length} request types and ${requests.length} requests.`);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });