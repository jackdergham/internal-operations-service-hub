import { Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import type { Actor } from '../directory/directory.types.js';
import type { ApprovalStepConfig, RequestTypeConfig, RequestTypeConfigInput, RoutingMode, WorkflowVersionSummary } from './config.types.js';

@Injectable()
export class ConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directoryService: DirectoryService,
  ) {}

  async listRequestTypes(actor: Actor): Promise<RequestTypeConfig[]> {
    this.requireAdmin(actor);
    const rows = await this.prisma.requestType.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => this.toConfig(row));
  }

  async getWorkflowVersions(actor: Actor, requestTypeId: string): Promise<WorkflowVersionSummary[]> {
    this.requireAdmin(actor);
    await this.mustFindRequestType(requestTypeId);
    const rows = await this.prisma.requestTypeVersion.findMany({
      where: { requestTypeId },
      orderBy: { version: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      requestTypeId: row.requestTypeId,
      version: row.version,
      routingMode: row.routingMode as RoutingMode,
      destinationQueue: row.destinationQueue,
      approvalChain: row.approvalChain as unknown as ApprovalStepConfig[],
      publishedBy: row.publishedBy,
      publishedAt: row.publishedAt.toISOString(),
    }));
  }

  async upsertRequestType(actor: Actor, input: RequestTypeConfigInput): Promise<RequestTypeConfig> {
    this.requireAdmin(actor);
    this.validateInput(input);

    const existing = await this.prisma.requestType.findUnique({ where: { id: input.id } });
    const row = await this.prisma.requestType.upsert({
      where: { id: input.id },
      update: {
        name: input.name.trim(),
        department: input.department.trim(),
        schema: this.toInputJson(input.schema),
        routingMode: input.routingMode,
        destinationQueue: input.destinationQueue.trim(),
        approvalChain: this.toInputJson(input.approvalChain),
      },
      create: {
        id: input.id,
        name: input.name.trim(),
        department: input.department.trim(),
        schema: this.toInputJson(input.schema),
        routingMode: input.routingMode,
        destinationQueue: input.destinationQueue.trim(),
        approvalChain: this.toInputJson(input.approvalChain),
        currentVersion: 0,
      },
    });

    void existing;
    return this.toConfig(row);
  }

  async publishRequestType(actor: Actor, requestTypeId: string): Promise<WorkflowVersionSummary> {
    this.requireAdmin(actor);
    const requestType = await this.mustFindRequestType(requestTypeId);
    this.validateStoredConfig(requestType);

    const version = requestType.currentVersion + 1;
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.requestType.update({
        where: { id: requestTypeId },
        data: { currentVersion: version },
      });
      return tx.requestTypeVersion.create({
        data: {
          id: randomUUID(),
          requestTypeId,
          version,
          name: requestType.name,
          department: requestType.department,
          schema: this.toInputJson(requestType.schema),
          routingMode: requestType.routingMode,
          destinationQueue: requestType.destinationQueue,
          approvalChain: this.toInputJson(requestType.approvalChain),
          publishedBy: actor.employeeId,
        },
      });
    });

    return {
      id: row.id,
      requestTypeId: row.requestTypeId,
      version: row.version,
      routingMode: row.routingMode as RoutingMode,
      destinationQueue: row.destinationQueue,
      approvalChain: row.approvalChain as unknown as ApprovalStepConfig[],
      publishedBy: row.publishedBy,
      publishedAt: row.publishedAt.toISOString(),
    };
  }

  private async mustFindRequestType(id: string) {
    const row = await this.prisma.requestType.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Request type not found');
    return row;
  }

  private requireAdmin(actor: Actor): void {
    if (!actor.roles.includes('admin')) {
      throw new ForbiddenException('Only an admin may change workflow configuration');
    }
  }

  private validateInput(input: RequestTypeConfigInput): void {
    if (!input || !/^[a-z0-9][a-z0-9-]*$/.test(input.id)) {
      throw new BadRequestException('id must contain lowercase letters, numbers, and hyphens');
    }
    if (!input.name?.trim() || !input.department?.trim() || !input.destinationQueue?.trim()) {
      throw new BadRequestException('name, department, and destinationQueue are required');
    }
    if (input.routingMode !== 'direct' && input.routingMode !== 'approval') {
      throw new BadRequestException('routingMode must be direct or approval');
    }
    if (!Array.isArray(input.schema?.fields) || !Array.isArray(input.schema?.required)) {
      throw new BadRequestException('schema.fields and schema.required are required');
    }
    const keys = new Set<string>();
    for (const field of input.schema.fields) {
      if (!field?.key || !field.label || !field.type || keys.has(field.key)) {
        throw new BadRequestException('each form field needs a unique key, label, and type');
      }
      keys.add(field.key);
    }
    if (input.schema.required.some((key) => !keys.has(key))) {
      throw new BadRequestException('required fields must exist in schema.fields');
    }
    if (!Array.isArray(input.approvalChain)) {
      throw new BadRequestException('approvalChain must be an array');
    }
    if (input.routingMode === 'approval' && input.approvalChain.length === 0) {
      throw new BadRequestException('approval routing requires at least one approval step');
    }
    for (const step of input.approvalChain) {
      if (!['manager', 'department-head', 'specific-user'].includes(step.type)) {
        throw new BadRequestException('unsupported approval step type');
      }
      if (step.type === 'specific-user' && !step.actorId) {
        throw new BadRequestException('specific-user approval steps require actorId');
      }
      if (step.actorId) this.directoryService.mustFind(step.actorId);
    }
  }

  private validateStoredConfig(row: { routingMode: string; destinationQueue: string; approvalChain: unknown }): void {
    if (!row.destinationQueue.trim()) throw new BadRequestException('destinationQueue is required');
    if (row.routingMode === 'approval' && (!Array.isArray(row.approvalChain) || row.approvalChain.length === 0)) {
      throw new BadRequestException('approval routing requires at least one approval step');
    }
  }

  private toConfig(row: {
    id: string; name: string; department: string; schema: unknown; routingMode: string;
    destinationQueue: string; approvalChain: unknown; currentVersion: number; updatedAt: Date;
  }): RequestTypeConfig {
    const schema = row.schema as { fields?: unknown; required?: unknown };
    return {
      id: row.id,
      name: row.name,
      department: row.department,
      schema: {
        fields: Array.isArray(schema.fields) ? schema.fields as RequestTypeConfigInput['schema']['fields'] : [],
        required: Array.isArray(schema.required) ? schema.required.filter((value): value is string => typeof value === 'string') : [],
      },
      routingMode: row.routingMode as RoutingMode,
      destinationQueue: row.destinationQueue,
      approvalChain: Array.isArray(row.approvalChain) ? row.approvalChain as ApprovalStepConfig[] : [],
      currentVersion: row.currentVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    throw new BadRequestException('JSON configuration cannot be null or undefined');
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
}
