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
    routingMode: 'approval',
    destinationQueue: 'IT',
    approvalChain: [{ type: 'manager' }],
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
    routingMode: 'approval',
    destinationQueue: 'HR',
    approvalChain: [{ type: 'manager' }, { type: 'department-head' }],
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
    routingMode: 'direct',
    destinationQueue: 'Operations',
    approvalChain: [],
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
    routingDecision: {
      id: 'seed-routing-001',
      requestTypeId: 'new-laptop',
      requesterId: 'employee-1',
      status: 'AwaitingApproval',
      destinationQueue: 'IT',
      approvalSteps: [
        {
          id: 'seed-approval-001',
          stepNumber: 1,
          approverId: 'manager-1',
          status: 'Pending',
        },
      ],
    },
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
    status: 'In Progress',
    idempotencyKey: 'seed-request-002',
    createdAt: new Date('2026-01-10T11:30:00.000Z'),
    events: [
      ['seed-event-002-submitted', 'Submitted', 'intake', '2026-01-10T11:30:00.000Z'],
      ['seed-event-002-pending', 'Pending Approval', 'routing', '2026-01-10T11:30:01.000Z'],
      ['seed-event-002-approved', 'Approved', 'routing', '2026-01-11T08:15:00.000Z'],
      ['seed-event-002-in-progress', 'In Progress', 'fulfillment', '2026-01-11T08:16:00.000Z'],
    ],
    routingDecision: {
      id: 'seed-routing-002',
      requestTypeId: 'pto-request',
      requesterId: 'employee-2',
      status: 'ReadyForQueue',
      destinationQueue: 'HR',
      approvalSteps: [
        {
          id: 'seed-approval-002-1',
          stepNumber: 1,
          approverId: 'manager-2',
          status: 'Approved',
          decidedBy: 'manager-2',
          decidedAt: new Date('2026-01-11T08:15:00.000Z'),
        },
        {
          id: 'seed-approval-002-2',
          stepNumber: 2,
          approverId: 'dept-head-hr',
          status: 'Approved',
          decidedBy: 'dept-head-hr',
          decidedAt: new Date('2026-01-11T08:15:00.000Z'),
        },
      ],
    },
    queueAssignment: {
      id: 'seed-assignment-002',
      queue: 'HR',
      assignedFulfillerId: 'fulfiller-hr-1',
      createdAt: new Date('2026-01-11T08:16:00.000Z'),
    },
    comments: [
      {
        id: 'seed-comment-002',
        authorId: 'fulfiller-hr-1',
        body: 'Leave dates confirmed with the HR team.',
        visibility: 'internal',
        createdAt: new Date('2026-01-11T08:20:00.000Z'),
      },
    ],
  },
  {
    id: 'REQ-SEED-003',
    requesterId: 'employee-1',
    requestTypeId: 'desk-relocation',
    description: 'Please move my desk closer to the product team area.',
    formData: { department: 'Operations', newLocation: 'Building B, Floor 2' },
    status: 'In Progress',
    idempotencyKey: 'seed-request-003',
    createdAt: new Date('2026-01-20T14:00:00.000Z'),
    events: [
      ['seed-event-003-submitted', 'Submitted', 'intake', '2026-01-20T14:00:00.000Z'],
      ['seed-event-003-in-progress', 'In Progress', 'fulfillment', '2026-01-20T14:00:01.000Z'],
    ],
    routingDecision: {
      id: 'seed-routing-003',
      requestTypeId: 'desk-relocation',
      requesterId: 'employee-1',
      status: 'ReadyForQueue',
      destinationQueue: 'Operations',
      approvalSteps: [],
    },
    queueAssignment: {
      id: 'seed-assignment-003',
      queue: 'Operations',
      assignedFulfillerId: null,
      createdAt: new Date('2026-01-20T14:00:01.000Z'),
    },
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
    const { events, attachment, queueAssignment, comments, routingDecision, ...requestData } = request;

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

    if (routingDecision) {
      const { approvalSteps, ...routingDecisionData } = routingDecision;
      await prisma.routingDecision.upsert({
        where: { id: routingDecisionData.id },
        update: { ...routingDecisionData, requestId: request.id },
        create: { ...routingDecisionData, requestId: request.id },
      });

      for (const step of approvalSteps) {
        await prisma.approvalStepInstance.upsert({
          where: { id: step.id },
          update: { ...step, routingDecisionId: routingDecisionData.id },
          create: { ...step, routingDecisionId: routingDecisionData.id },
        });
      }
    }

    if (queueAssignment) {
      await prisma.queueAssignment.upsert({
        where: { requestId: request.id },
        update: queueAssignment,
        create: { ...queueAssignment, requestId: request.id },
      });
    }

    for (const comment of comments ?? []) {
      await prisma.fulfillmentComment.upsert({
        where: { id: comment.id },
        update: comment,
        create: { ...comment, requestId: request.id },
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