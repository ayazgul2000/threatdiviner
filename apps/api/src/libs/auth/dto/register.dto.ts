import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * Register request DTO
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  /**
   * Tenant slug - required in multi-tenant mode
   */
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  /**
   * User role
   * @default 'member'
   */
  @IsOptional()
  @IsString()
  role?: string;
}
