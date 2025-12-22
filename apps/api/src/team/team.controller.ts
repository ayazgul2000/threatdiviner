import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { InviteUserDto, UpdateUserRoleDto } from './dto';
import { JwtAuthGuard, CurrentUser, RequirePermission, PermissionsGuard } from '../libs/auth';
import { Permission } from '../libs/auth/permissions/permissions.enum';

@Controller('team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('users')
  @RequirePermission(Permission.USERS_READ)
  async listUsers(@CurrentUser() user: any) {
    return this.teamService.listUsers(user.tenantId);
  }

  @Get('users/:id')
  @RequirePermission(Permission.USERS_READ)
  async getUser(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.teamService.getUser(user.tenantId, userId);
  }

  @Post('invite')
  @RequirePermission(Permission.USERS_MANAGE)
  async inviteUser(@CurrentUser() user: any, @Body() dto: InviteUserDto) {
    return this.teamService.inviteUser(user.tenantId, user.id, dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body() dto: { inviteToken: string; password: string; name?: string },
  ) {
    return this.teamService.acceptInvite(dto.inviteToken, dto.password, dto.name);
  }

  @Put('users/:id/role')
  @RequirePermission(Permission.USERS_MANAGE)
  async updateUserRole(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.teamService.updateUserRole(user.tenantId, userId, user.id, dto.role);
  }

  @Delete('users/:id')
  @RequirePermission(Permission.USERS_MANAGE)
  async removeUser(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.teamService.removeUser(user.tenantId, userId, user.id);
  }

  @Post('resend-invite/:id')
  @RequirePermission(Permission.USERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async resendInvite(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.teamService.resendInvite(user.tenantId, userId);
  }

  @Post('users/:id/disable')
  @RequirePermission(Permission.USERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async disableUser(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.teamService.disableUser(user.tenantId, userId, user.id);
  }

  @Post('users/:id/enable')
  @RequirePermission(Permission.USERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  async enableUser(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.teamService.enableUser(user.tenantId, userId);
  }
}
