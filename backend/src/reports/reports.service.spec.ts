import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  let prisma: PrismaService;
  let directoryService: DirectoryService;
  let service: ReportsService;

  const admin = () => directoryService.mustFind('admin-1');
  const itFulfiller = () => directoryService.mustFind('fulfiller-it-1');
  const requester = () => directoryService.mustFind('employee-1');

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    directoryService = new DirectoryService();
    service = new ReportsService(prisma);

    await prisma.fulfillmentComment.deleteMany();
    await prisma.queueAssignment.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.request.deleteMany();

    for (const requestType of [
      { id: 'new-laptop', name: 'New laptop / equipment', department: 'IT' },
      { id: 'pto-request', name: 'PTO / annual leave', department: 'HR' },
    ]) {
      await prisma.requestType.upsert({
        where: { id: requestType.id },
        update: { name: requestType.name, department: requestType.department },
        create: { ...requestType, schema: { required: [], fields: [] } },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.fulfillmentComment.deleteMany();
    await prisma.queueAssignment.deleteMany();
    await prisma.approvalStepInstance.deleteMany();
    await prisma.routingDecision.deleteMany();
    await prisma.statusEvent.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.request.deleteMany();

    await createRequest('REQ-REPORT-001', {
      requesterId: 'employee-1',
      requestTypeId: 'new-laptop',
      status: 'Closed',
      createdAt: '2026-01-05T09:00:00.000Z',
      events: [
        ['Submitted', 'intake', '2026-01-05T09:00:00.000Z'],
        ['In Progress', 'fulfillment', '2026-01-05T10:00:00.000Z'],
        ['Resolved', 'fulfillment', '2026-01-05T10:30:00.000Z'],
        ['Closed', 'fulfillment', '2026-01-05T11:00:00.000Z'],
      ],
    });

    await createRequest('REQ-REPORT-002', {
      requesterId: 'employee-2',
      requestTypeId: 'pto-request',
      status: 'In Progress',
      createdAt: '2026-01-06T09:00:00.000Z',
      events: [
        ['Submitted', 'intake', '2026-01-06T09:00:00.000Z'],
        ['In Progress', 'fulfillment', '2026-01-06T09:30:00.000Z'],
      ],
    });
  });

  async function createRequest(id: string, seed: RequestSeed): Promise<void> {
    await prisma.request.create({
      data: {
        id,
        requesterId: seed.requesterId,
        requestTypeId: seed.requestTypeId,
        description: 'A request used by the reports test suite.',
        formData: {},
        status: seed.status,
        createdAt: new Date(seed.createdAt),
        statusEvents: {
          create: seed.events.map(([status, source, createdAt], index) => ({
            id: `${id}-event-${index}`,
            status,
            source,
            createdAt: new Date(createdAt),
          })),
        },
      },
    });
  }

  it('derives cycle time from the status trail', async () => {
    const summary = await service.buildSummary(admin());
    const closed = summary.requests.find((row) => row.id === 'REQ-REPORT-001');

    expect(closed?.cycleTimeHours).toBe(1.5);
    expect(closed?.firstResponseAt).toBe('2026-01-05T10:00:00.000Z');
  });

  it('reports an unfinished request with no cycle time', async () => {
    const summary = await service.buildSummary(admin());
    const open = summary.requests.find((row) => row.id === 'REQ-REPORT-002');

    expect(open?.cycleTimeHours).toBeNull();
    expect(open?.closedAt).toBeNull();
  });

  it('computes totals and a completion rate over the whole dataset', async () => {
    const summary = await service.buildSummary(admin());

    expect(summary.scope).toBe('all');
    expect(summary.totals).toMatchObject({ requests: 2, closed: 1, inFlight: 1, completionRate: 50 });
    expect(summary.totals.avgResolutionHours).toBe(1.5);
  });

  it('breaks results down per department using the request type department', async () => {
    const summary = await service.buildSummary(admin());
    const hr = summary.departments.find((row) => row.department === 'HR');
    const it = summary.departments.find((row) => row.department === 'IT');

    expect(it).toMatchObject({ total: 1, closed: 1, inFlight: 0, completionRate: 100 });
    expect(hr).toMatchObject({ total: 1, closed: 0, inFlight: 1, completionRate: 0 });
  });

  it('limits a fulfiller to their own department', async () => {
    const summary = await service.buildSummary(itFulfiller());

    expect(summary.scope).toBe('department');
    expect(summary.requests.map((row) => row.id)).toEqual(['REQ-REPORT-001']);
  });

  it('limits a requester to the requests they raised', async () => {
    const summary = await service.buildSummary(requester());

    expect(summary.scope).toBe('requester');
    expect(summary.requests.map((row) => row.id)).toEqual(['REQ-REPORT-001']);
  });

  it('always returns six trend points ordered oldest first', async () => {
    const summary = await service.buildSummary(admin());

    expect(summary.trend).toHaveLength(6);
    expect(summary.trend.at(-1)?.period).toBe(new Date().toISOString().slice(0, 7));
    expect(summary.trend[0].period < summary.trend.at(-1)!.period).toBe(true);
  });

  it('exports a CSV built from the same rows as the summary', async () => {
    const csv = await service.buildCsv(admin());
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Request ID,Request Type,Department,Status,Submitted,First Response,Resolved,Closed,Cycle Time (hours)');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('REQ-REPORT-001');
    expect(lines[1].endsWith(',1.5')).toBe(true);
  });

  it('quotes CSV cells that contain a comma', async () => {
    await prisma.requestType.upsert({
      where: { id: 'relocation' },
      update: {},
      create: { id: 'relocation', name: 'Desk relocation, building B', department: 'Operations', schema: { required: [], fields: [] } },
    });
    await createRequest('REQ-REPORT-003', {
      requesterId: 'employee-1',
      requestTypeId: 'relocation',
      status: 'Submitted',
      createdAt: '2026-01-07T09:00:00.000Z',
      events: [['Submitted', 'intake', '2026-01-07T09:00:00.000Z']],
    });

    const csv = await service.buildCsv(admin());
    expect(csv).toContain('"Desk relocation, building B"');
  });

  it('formats sub-hour cycle times in minutes rather than rounding them to zero', async () => {
    await prisma.request.deleteMany();
    await createRequest('REQ-REPORT-004', {
      requesterId: 'employee-1',
      requestTypeId: 'new-laptop',
      status: 'Closed',
      createdAt: '2026-01-08T09:00:00.000Z',
      events: [
        ['Submitted', 'intake', '2026-01-08T09:00:00.000Z'],
        ['Resolved', 'fulfillment', '2026-01-08T09:20:00.000Z'],
        ['Closed', 'fulfillment', '2026-01-08T09:25:00.000Z'],
      ],
    });

    const summary = await service.buildSummary(admin());
    expect(summary.kpis.at(-1)?.value).toBe('20m');
  });

  it('handles an empty dataset without dividing by zero', async () => {
    await prisma.request.deleteMany();

    const summary = await service.buildSummary(admin());

    expect(summary.totals).toMatchObject({ requests: 0, closed: 0, completionRate: 0, avgResolutionHours: null });
    expect(summary.departments).toEqual([]);
    expect(summary.requests).toEqual([]);
  });
});

type RequestSeed = {
  requesterId: string;
  requestTypeId: string;
  status: string;
  createdAt: string;
  events: Array<[string, string, string]>;
};
