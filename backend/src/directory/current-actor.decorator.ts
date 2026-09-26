import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Actor } from './directory.types.js';

export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor ?? null;
  },
);
