import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';

@Controller('checklists')
export class ChecklistsController {
  @UseGuards(JwtAuthGuard)
  @Roles(Role.PROVIDER)
  @Post('submit')
  submit(
    @Body()
    body: {
      serviceRequestId: string;
      answers: Array<{ key: string; value: string }>;
    },
  ) {
    return {
      id: `chk-${Date.now()}`,
      serviceRequestId: body.serviceRequestId,
      answers: body.answers,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    };
  }
}
