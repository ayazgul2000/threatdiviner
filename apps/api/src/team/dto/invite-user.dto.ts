import { IsEmail, IsString, IsIn, IsOptional } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['viewer', 'developer', 'member', 'security_lead', 'admin'])
  role!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
