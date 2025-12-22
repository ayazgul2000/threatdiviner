/**
 * Configuration options for @altaniche/auth module
 */
export interface AltanicheAuthConfig {
  /**
   * JWT secret for access tokens
   * @default process.env.JWT_SECRET
   */
  jwtSecret: string;

  /**
   * JWT secret for refresh tokens
   * @default process.env.JWT_REFRESH_SECRET
   */
  jwtRefreshSecret: string;

  /**
   * Access token expiration time
   * @default '15m'
   */
  accessTokenExpiry?: string;

  /**
   * Refresh token expiration time
   * @default '7d'
   */
  refreshTokenExpiry?: string;

  /**
   * Cookie name for access token
   * @default 'accessToken'
   */
  accessTokenCookieName?: string;

  /**
   * Cookie name for refresh token
   * @default 'refreshToken'
   */
  refreshTokenCookieName?: string;

  /**
   * Enable multi-tenant mode
   * When true, tenantId/tenantSlug are included in JWT payload
   * @default true
   */
  multiTenant?: boolean;

  /**
   * Routes to exclude from tenant middleware
   * @default ['auth/(.*)', 'health']
   */
  excludedRoutes?: string[];

  /**
   * User repository adapter for database operations
   * Required - implement IUserRepository interface
   */
  userRepository: IUserRepository;

  /**
   * Tenant repository adapter for database operations
   * Required when multiTenant is true
   */
  tenantRepository?: ITenantRepository;

  /**
   * Function to set tenant context in database (for RLS)
   * Called by TenantMiddleware when a valid token is present
   */
  setTenantContext?: (tenantId: string) => Promise<void>;

  /**
   * Bcrypt salt rounds for password hashing
   * @default 10
   */
  bcryptRounds?: number;
}

/**
 * User entity interface - implement this in your application
 */
export interface IUser {
  id: string;
  email: string;
  name?: string | null;
  passwordHash: string | null;
  role: string;
  tenantId?: string;
  createdAt?: Date;
}

/**
 * Tenant entity interface - implement this for multi-tenant apps
 */
export interface ITenant {
  id: string;
  name: string;
  slug: string;
  plan?: string;
}

/**
 * User repository interface - implement this in your application
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: string): Promise<IUser | null>;

  /**
   * Find user by email (and optionally tenant)
   */
  findByEmail(email: string, tenantId?: string): Promise<IUser | null>;

  /**
   * Create a new user
   */
  create(data: {
    email: string;
    passwordHash: string;
    role: string;
    tenantId?: string;
  }): Promise<IUser>;

  /**
   * Update user data
   */
  update?(id: string, data: Partial<{ name: string; passwordHash: string }>): Promise<IUser>;

  /**
   * Find user by ID with tenant info
   */
  findByIdWithTenant?(id: string): Promise<(IUser & { tenant?: ITenant }) | null>;
}

/**
 * Tenant repository interface - implement for multi-tenant apps
 */
export interface ITenantRepository {
  /**
   * Find tenant by slug
   */
  findBySlug(slug: string): Promise<ITenant | null>;

  /**
   * Find tenant by ID
   */
  findById(id: string): Promise<ITenant | null>;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: string;
  /** Tenant ID (multi-tenant mode) */
  tenantId?: string;
  /** Tenant slug (multi-tenant mode) */
  tenantSlug?: string;
  /** Token type */
  type: 'access' | 'refresh';
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * User info returned after authentication
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
}

/**
 * Full authentication response
 */
export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
