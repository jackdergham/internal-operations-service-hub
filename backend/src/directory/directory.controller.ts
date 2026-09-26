import { Controller, Get, Param } from '@nestjs/common';
import { DirectoryService } from './directory.service.js';

@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('actors')
  listActors() {
    return this.directoryService.list();
  }

  @Get('actors/:employeeId')
  getActor(@Param('employeeId') employeeId: string) {
    return this.directoryService.mustFind(employeeId);
  }
}
