import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';

@Injectable()
export class ActorResolverGuard implements CanActivate {
  constructor(private readonly directoryService: DirectoryService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actorId = request.headers['x-actor-id'];

    request.actor =
      typeof actorId === 'string' && actorId.length > 0
        ? (this.directoryService.findById(actorId) ?? null)
        : null;

    return true;
  }
}
