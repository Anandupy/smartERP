import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * CampusFlow ERP — Environment Configuration Contract
 *
 * Every environment variable the backend depends on is declared here and
 * validated once, at process start, before the Nest application is created.
 *
 * A misconfigured deployment must fail loudly at boot rather than surface later
 * as an authentication bypass, a missing table, or a request that silently uses
 * a fallback secret.
 */

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

/**
 * Secrets that ship in example files, tutorials, or previous versions of this
 * repository. They are rejected outright: a deployment holding one of these is
 * functionally unauthenticated.
 */
const FORBIDDEN_SECRETS = new Set([
  'default-secret',
  'super-secret',
  'super-refresh-secret',
  'secret',
  'changeme',
  'change-me',
  'your-secret-key',
  'jwt-secret',
  'test-secret',
]);

const MIN_SECRET_LENGTH = 32;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
};

const toInteger = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
};

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment, {
    message: `NODE_ENV must be one of: ${Object.values(NodeEnvironment).join(', ')}`,
  })
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(toInteger)
  @IsInt({ message: 'PORT must be an integer' })
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  // --- Database -----------------------------------------------------------

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a postgresql:// connection string',
  })
  DATABASE_URL!: string;

  // --- Authentication -----------------------------------------------------

  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required' })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_REFRESH_SECRET is required' })
  JWT_REFRESH_SECRET!: string;

  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_EXPIRES_IN must look like 15m, 1h, 7d',
  })
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_REFRESH_EXPIRES_IN must look like 15m, 1h, 7d',
  })
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  /**
   * Reserved for encryption of provider credentials at rest. Not consumed yet —
   * validated only when supplied so that a malformed key is caught before the
   * feature starts depending on it.
   */
  @MinLength(MIN_SECRET_LENGTH, {
    message: `ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters`,
  })
  @IsOptional()
  ENCRYPTION_KEY?: string;

  // --- Bootstrap seeding --------------------------------------------------

  @Transform(toBoolean)
  @IsBoolean({ message: 'SEED_ON_BOOTSTRAP must be a boolean' })
  @IsOptional()
  SEED_ON_BOOTSTRAP?: boolean;

  @IsString()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  // --- HTTP ---------------------------------------------------------------

  /** Comma-separated allow-list. Omit to allow all origins (non-production only). */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // --- Throttling ---------------------------------------------------------

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  THROTTLE_ENABLED?: boolean;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_TTL: number = 60;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT: number = 120;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_AUTH_TTL: number = 300;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_AUTH_LIMIT: number = 10;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_OTP_TTL: number = 300;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_OTP_LIMIT: number = 5;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_PASSWORD_RESET_TTL: number = 900;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_PASSWORD_RESET_LIMIT: number = 5;

  // --- Logging ------------------------------------------------------------

  @IsEnum(LogLevel, {
    message: `LOG_LEVEL must be one of: ${Object.values(LogLevel).join(', ')}`,
  })
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsString()
  @IsOptional()
  LOG_DIR?: string;
}

/**
 * Cross-field and environment-sensitive rules that cannot be expressed as
 * single-property decorators.
 */
function collectSemanticErrors(config: EnvironmentVariables): string[] {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === NodeEnvironment.Production;

  const secrets: Array<[string, string | undefined]> = [
    ['JWT_SECRET', config.JWT_SECRET],
    ['JWT_REFRESH_SECRET', config.JWT_REFRESH_SECRET],
  ];

  for (const [name, value] of secrets) {
    if (!value) continue;

    if (FORBIDDEN_SECRETS.has(value.trim().toLowerCase())) {
      errors.push(
        `${name} is set to a well-known placeholder value and must be replaced with a generated secret`,
      );
      continue;
    }

    if (value.length < MIN_SECRET_LENGTH) {
      const message = `${name} must be at least ${MIN_SECRET_LENGTH} characters (got ${value.length})`;
      // Outside production a short secret is a warning-level problem, but a
      // deployment is never allowed to run on one.
      if (isProduction) {
        errors.push(message);
      }
    }
  }

  if (
    config.JWT_SECRET &&
    config.JWT_REFRESH_SECRET &&
    config.JWT_SECRET === config.JWT_REFRESH_SECRET
  ) {
    errors.push(
      'JWT_SECRET and JWT_REFRESH_SECRET must be different values, otherwise a refresh token is accepted as an access token',
    );
  }

  if (config.SEED_ON_BOOTSTRAP === true) {
    if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
      errors.push(
        'SEED_ON_BOOTSTRAP is enabled but ADMIN_EMAIL and ADMIN_PASSWORD are not both set',
      );
    }
  }

  if (isProduction && config.SEED_ON_BOOTSTRAP === true) {
    errors.push(
      'SEED_ON_BOOTSTRAP must not be enabled in production; run the seed explicitly as a deployment step instead',
    );
  }

  if (isProduction && !config.CORS_ORIGINS) {
    errors.push(
      'CORS_ORIGINS is required in production; an unrestricted CORS policy is not acceptable for a deployed API',
    );
  }

  if (isProduction && /_test(\?|$)/.test(config.DATABASE_URL ?? '')) {
    errors.push(
      'DATABASE_URL points at a _test database while NODE_ENV is production',
    );
  }

  return errors;
}

/**
 * ConfigModule `validate` hook. Runs once, before any provider is instantiated.
 */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const validationErrors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: false,
    forbidUnknownValues: false,
  });

  const messages = validationErrors.flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );

  messages.push(...collectSemanticErrors(config));

  if (messages.length > 0) {
    const formatted = messages.map((m) => `  • ${m}`).join('\n');
    throw new Error(
      `\nInvalid environment configuration — refusing to start:\n${formatted}\n\n` +
        `Fix the variables above in your .env file (see .env.example) and restart.\n`,
    );
  }

  return config;
}
