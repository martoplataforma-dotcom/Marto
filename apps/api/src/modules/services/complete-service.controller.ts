import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '../identity/roles/roles.guard';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';

@Controller('services')
export class CompleteServiceController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @Post('complete')
  complete(
    @Body()
    body: {
      serviceRequestId: string;
      payoutId: string;
    },
  ) {
    return {
      serviceRequestId: body.serviceRequestId,
      serviceStatus: 'COMPLETED',
      payout: {
        id: body.payoutId,
        fromStatus: 'HELD',
        toStatus: 'RELEASED',
        releasedAt: new Date().toISOString(),
      },
    };
  }
}
