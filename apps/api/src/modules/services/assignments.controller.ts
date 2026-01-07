import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '../identity/roles/roles.guard';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';

@Controller('assignments')
export class AssignmentsController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @Post()
  assign(
    @Body()
    body: {
      serviceRequestId: string;
      providerId: string;
    },
  ) {
    return {
      id: `as-${Date.now()}`,
      serviceRequestId: body.serviceRequestId,
      providerId: body.providerId,
      status: 'ASSIGNED',
      assignedAt: new Date().toISOString(),
    };
  }
}
