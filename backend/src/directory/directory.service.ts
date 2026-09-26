import { Injectable, NotFoundException } from '@nestjs/common';
import { orgChart } from './directory.data.js';
import type { Actor, Role } from './directory.types.js';

@Injectable()
export class DirectoryService {
  private readonly actors = new Map<string, Actor>(
    orgChart.map((actor) => [actor.employeeId, actor]),
  );

  list(): Actor[] {
    return [...this.actors.values()];
  }

  findById(employeeId: string): Actor | undefined {
    return this.actors.get(employeeId);
  }

  mustFind(employeeId: string): Actor {
    const actor = this.findById(employeeId);
    if (!actor) throw new NotFoundException(`Unknown employeeId: ${employeeId}`);
    return actor;
  }

  getManagerId(employeeId: string): string | null {
    return this.findById(employeeId)?.managerId ?? null;
  }

  hasRole(employeeId: string, role: Role): boolean {
    return this.findById(employeeId)?.roles.includes(role) ?? false;
  }

  findByRoleAndDepartment(role: Role, department: string): Actor[] {
    return this.list().filter(
      (actor) => actor.roles.includes(role) && actor.department === department,
    );
  }
}
