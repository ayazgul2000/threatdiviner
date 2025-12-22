import { IsString, IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(['viewer', 'developer', 'member', 'security_lead', 'admin'])
  role!: string;
}
