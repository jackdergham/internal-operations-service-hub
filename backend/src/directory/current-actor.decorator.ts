import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Actor } from './directory.types.js';

/**
 * Reads the Actor attached by ActorResolverGuard. Returns null if the guard
 * wasn't applied on this route, or if x-actor-id didn't match anyone in the
 * directory.
 */
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor ?? null;
  },
);
