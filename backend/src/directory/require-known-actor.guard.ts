import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';

@Injectable()
export class RequireKnownActorGuard implements CanActivate {
  constructor(private readonly directoryService: DirectoryService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actorId = request.headers['x-actor-id'];

    if (typeof actorId !== 'string' || actorId.length === 0) {
      throw new UnauthorizedException('x-actor-id header is required');
    }

    const actor = this.directoryService.findById(actorId);
    if (!actor) {
      throw new UnauthorizedException(`Unknown actor: ${actorId}`);
    }

    request.actor = actor;
    return true;
  }
}
