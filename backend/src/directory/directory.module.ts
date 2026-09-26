import { Module } from '@nestjs/common';
import { DirectoryController } from './directory.controller.js';
import { DirectoryService } from './directory.service.js';
import { ActorResolverGuard } from './actor-resolver.guard.js';
import { RequireKnownActorGuard } from './require-known-actor.guard.js';

@Module({
  controllers: [DirectoryController],
  providers: [DirectoryService, ActorResolverGuard, RequireKnownActorGuard],
  exports: [DirectoryService, ActorResolverGuard, RequireKnownActorGuard],
})
export class DirectoryModule {}
