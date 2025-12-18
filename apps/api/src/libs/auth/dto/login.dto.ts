import { IsEmail, IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Login request DTO
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /**
   * Tenant slug - required in multi-tenant mode
   */
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
