import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';

/**
 * Resolves the `x-actor-id` header against the mock org chart and attaches
 * the result to `request.actor`. This is the directory doubling as a stand-in
 * identity provider: instead of trusting a bare string id, callers get back a
 * full Actor (name, department, roles) when the id is recognized.
 *
 * Deliberately permissive: an unknown or missing actor id resolves to
 * `request.actor = null` rather than rejecting the request. Real endpoint
 * authorization (e.g. "only the designated approver may decide this step")
 * stays where it already lives, in the relevant service, and is unaffected by
 * this guard either way. This keeps the guard safe to add to a route without
 * it starting to reject the synthetic actor ids some existing tests use.
 */
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
