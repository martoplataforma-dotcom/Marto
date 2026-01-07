import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/role.enum';
import { RolesGuard } from '../roles/roles.guard';

type AuthedRequest = {
  user: {
    sub: string;
    email: string;
    role: Role;
    iat?: number;
    exp?: number;
  };
};

@Controller('me-auth')
export class MeController {
  // MOCK em memória só pra destravar o onboarding
  private readonly rolesByUser = new Map<string, Set<string>>();

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get()
  me(@Req() req: AuthedRequest) {
    const roles = Array.from(this.rolesByUser.get(req.user.sub) ?? []);

    return {
      user: req.user,
      roles,
      needsRoleChoice: roles.length === 0,
    };
  }

  // ✅ DESATIVADO pra não conflitar com o controller novo em modules/identity/me
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.USER)
  // @Post('roles')
  // addRole(@Req() req: AuthedRequest, @Body() body: AddRoleBody) {
  //   const role = String(body?.role ?? '')
  //     .trim()
  //     .toUpperCase();
  //
  //   if (!role) return { ok: false, message: 'role é obrigatório' };
  //
  //   const set = this.rolesByUser.get(req.user.sub) ?? new Set<string>();
  //   set.add(role);
  //   this.rolesByUser.set(req.user.sub, set);
  //
  //   return { ok: true, created: { role } };
  // }
}
