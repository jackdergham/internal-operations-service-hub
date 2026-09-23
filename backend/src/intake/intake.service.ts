import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RoutingService } from '../routing/routing.service.js';
import {
  CreateRequestInput,
  CreateRequestResponse,
} from './intake.types.js';

const requestTypes = [
  {
    id: 'new-laptop',
    name: 'New laptop / equipment',
    department: 'IT',
    schema: {
      required: ['department'],
      fields: [{ key: 'department', label: 'Department', type: 'text' }],
    },
  },
  {
    id: 'pto-request',
    name: 'PTO / annual leave',
    department: 'HR',
    schema: {
      required: ['department', 'startDate', 'endDate'],
      fields: [
        { key: 'department', label: 'Department', type: 'text' },
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
      required: ['department', 'newLocation'],
      fields: [
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'newLocation', label: 'New location', type: 'text' },
      ],
    },
  },
];

@Injectable()
export class IntakeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly routingService?: RoutingService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const requestType of requestTypes) {
      await this.prisma.requestType.upsert({
        where: { id: requestType.id },
        update: requestType,
        create: requestType,
      });
    }
  }

  async createRequest(
    actorId: string | undefined,
    input: CreateRequestInput,
  ): Promise<CreateRequestResponse> {
    this.validateAuthorization(actorId, input.requesterId);
    this.validateInput(input);

    const requestType = await this.prisma.requestType.findUnique({
      where: { id: input.requestTypeId },
    });

    if (!requestType) {
      throw new NotFoundException('Request type not found');
    }

    this.validateFormData(requestType.schema, input.formData);

    if (input.idempotencyKey) {
      const existing = await this.prisma.request.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { attachments: true, statusEvents: true },
      });

      if (existing) {
        await this.routingService?.registerRequest({
          id: existing.id,
          requesterId: existing.requesterId,
          requestTypeId: existing.requestTypeId,
          createdAt: existing.createdAt,
        });
        const replayedRequest = await this.prisma.request.findUniqueOrThrow({
          where: { id: existing.id },
          include: { attachments: true, statusEvents: true },
        });
        return { request: this.toResponse(replayedRequest), replayed: true };
      }
    }

    try {
      const request = await this.prisma.request.create({
        data: {
          id: `REQ-${randomUUID().slice(0, 8).toUpperCase()}`,
          requesterId: input.requesterId,
          requestTypeId: input.requestTypeId,
          description: input.description.trim(),
          formData: input.formData as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
          attachments: {
            create: (input.attachments ?? []).map((attachment) => ({
              id: randomUUID(),
              ...attachment,
            })),
          },
          statusEvents: {
            create: {
              id: randomUUID(),
              status: 'Submitted',
              source: 'intake',
            },
          },
        },
        include: { attachments: true, statusEvents: true },
      });

      await this.routingService?.registerRequest({
        id: request.id,
        requesterId: request.requesterId,
        requestTypeId: request.requestTypeId,
        createdAt: request.createdAt,
      });

      const routedRequest = await this.prisma.request.findUniqueOrThrow({
        where: { id: request.id },
        include: { attachments: true, statusEvents: true },
      });

      return { request: this.toResponse(routedRequest), replayed: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A request with this idempotency key already exists');
      }
      throw error;
    }
  }

  async listRequestTypes() {
    return this.prisma.requestType.findMany({
      select: { id: true, name: true, department: true, schema: true },
      orderBy: { name: 'asc' },
    });
  }

  private validateAuthorization(actorId: string | undefined, requesterId: string): void {
    if (!actorId || actorId !== requesterId) {
      throw new ForbiddenException('x-actor-id must identify the requester');
    }
  }

  private validateInput(input: CreateRequestInput): void {
    if (!input || !input.requesterId || !input.requestTypeId) {
      throw new BadRequestException('requesterId and requestTypeId are required');
    }

    if (!input.description || input.description.trim().length < 10) {
      throw new BadRequestException('description must be at least 10 characters');
    }

    if (!input.formData || typeof input.formData !== 'object' || Array.isArray(input.formData)) {
      throw new BadRequestException('formData must be an object');
    }

    for (const attachment of input.attachments ?? []) {
      if (!attachment.filename || attachment.size < 0 || !attachment.contentType || !attachment.storageReference) {
        throw new BadRequestException('attachment metadata is invalid');
      }
    }
  }

  private validateFormData(schema: unknown, formData: Record<string, unknown>): void {
    const required = (schema as { required?: unknown })?.required;
    if (!Array.isArray(required)) return;

    const missing = required.filter((field): field is string =>
      typeof field === 'string' && (formData[field] === undefined || formData[field] === ''),
    );

    if (missing.length > 0) {
      throw new BadRequestException(`Missing form fields: ${missing.join(', ')}`);
    }
  }

  private toResponse(request: {
    id: string;
    requesterId: string;
    requestTypeId: string;
    description: string;
    formData: Prisma.JsonValue;
    status: string;
    createdAt: Date;
    attachments: Array<{ filename: string; size: number; contentType: string; storageReference: string }>;
    statusEvents: Array<{ status: string; source: string; createdAt: Date }>;
  }): CreateRequestResponse['request'] {
    return {
      id: request.id,
      requesterId: request.requesterId,
      requestTypeId: request.requestTypeId,
      description: request.description,
      formData: request.formData,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      attachments: request.attachments,
      statusEvents: request.statusEvents.map((event) => ({
        status: event.status,
        source: event.source,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
