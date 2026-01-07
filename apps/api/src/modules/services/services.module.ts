import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller';
import { AssignmentsController } from './assignments.controller';
import { ChecklistsController } from './checklists.controller';
import { CompleteServiceController } from './complete-service.controller';

@Module({
  imports: [],
  controllers: [
    ServiceRequestsController,
    AssignmentsController,
    ChecklistsController,
    CompleteServiceController,
  ],
  providers: [],
  exports: [],
})
export class ServicesModule {}
