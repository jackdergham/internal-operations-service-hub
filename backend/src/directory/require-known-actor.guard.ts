import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';

/**
 * Like ActorResolverGuard, but enforcing: rejects the request outright if
 * `x-actor-id` is missing or doesn't match anyone in the directory, instead
 * of letting it through with `request.actor = null`.
 *
 * Use this on routes where "who is making this request" must be a real,
 * known identity (submitting on someone's behalf, deciding an approval
 * step) rather than an optional enrichment.
 */
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
