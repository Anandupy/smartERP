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

  // --- Identity & sensitive data -------------------------------------------

  /**
   * The symmetric key-encryption key that wraps every organization's data key.
   *
   * Consumed as of Phase 1 — `docs/core/configuration.md` §5 previously
   * recorded this as reserved, which is no longer true.
   *
   * Must be exactly 32 bytes, base64 or hex encoded. A passphrase of the same
   * character count has far less entropy than it appears to, so the encoding is
   * checked rather than the length:
   *
   *     openssl rand -base64 32
   */
  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string;

  /**
   * The pepper for identity blind indexes.
   *
   * ⚠️ This value can never change once identity data exists. Changing it
   * raises no error — it silently stops duplicate detection from finding
   * anyone, and every existing index becomes unmatchable.
   */
  @MinLength(MIN_SECRET_LENGTH, {
    message: `IDENTITY_HASH_PEPPER must be at least ${MIN_SECRET_LENGTH} characters`,
  })
  @IsOptional()
  IDENTITY_HASH_PEPPER?: string;

  /**
   * PEM **public** key of the recovery keypair.
   *
   * Only the public half belongs here. The private half lives offline, which is
   * what makes recovery survive a full server compromise — see
   * `docs/core/key-custody.md`. A deployment that sets the private half by
   * mistake has defeated the entire mechanism, so the format is validated at
   * boot and a private key is rejected.
   */
  @IsString()
  @IsOptional()
  KEK_RECOVERY_PUBLIC_KEY?: string;

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

  /**
   * Trust X-Forwarded-For. Enable only when the app sits behind a proxy you
   * control � otherwise a client can forge its own source address and defeat
   * IP-based rate limiting.
   */
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  TRUST_PROXY?: boolean;

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

  // --- Document storage (S3/R5) --------------------------------------------

  /**
   * Which `StoragePort` adapter to bind. Only `local` (development
   * filesystem) is implemented; anything else fails at boot naming exactly
   * what is missing rather than falling back silently. See
   * `StorageModule` and docs/planning/document-management-specification.md.
   */
  @IsString()
  @IsOptional()
  DOCUMENT_STORAGE_PROVIDER?: string;

  /** Root directory for the `local` storage adapter. Defaults to `./storage/documents`. */
  @IsString()
  @IsOptional()
  DOCUMENT_STORAGE_LOCAL_ROOT?: string;
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

  errors.push(...collectIdentityCryptoErrors(config, isProduction));

  return errors;
}

/**
 * Identity crypto configuration.
 *
 * Every message here names the variable and the remedy and never echoes the
 * value: a validation error is printed to a console, a log aggregator and
 * usually a CI transcript, which is the last place a key should appear.
 */
function collectIdentityCryptoErrors(
  config: EnvironmentVariables,
  isProduction: boolean,
): string[] {
  const errors: string[] = [];

  // Checking that the key *decodes to 32 bytes* rather than that it is "long
  // enough". A 44-character passphrase passes a length check and is not a key.
  if (config.ENCRYPTION_KEY) {
    if (!isThirtyTwoByteKey(config.ENCRYPTION_KEY)) {
      errors.push(
        'ENCRYPTION_KEY must be exactly 32 bytes encoded as base64 or hex — generate one with `openssl rand -base64 32`',
      );
    }
  } else if (isProduction) {
    errors.push(
      'ENCRYPTION_KEY is required in production; sensitive identity data cannot be stored without it',
    );
  }

  if (!config.IDENTITY_HASH_PEPPER && isProduction) {
    errors.push(
      'IDENTITY_HASH_PEPPER is required in production; identity matching cannot run without it',
    );
  }

  if (
    config.IDENTITY_HASH_PEPPER &&
    FORBIDDEN_SECRETS.has(config.IDENTITY_HASH_PEPPER.trim().toLowerCase())
  ) {
    errors.push(
      'IDENTITY_HASH_PEPPER is set to a well-known placeholder value and must be replaced with a generated secret',
    );
  }

  if (
    config.ENCRYPTION_KEY &&
    config.IDENTITY_HASH_PEPPER &&
    config.ENCRYPTION_KEY === config.IDENTITY_HASH_PEPPER
  ) {
    errors.push(
      'ENCRYPTION_KEY and IDENTITY_HASH_PEPPER must be different values; reusing one secret for both means a single disclosure breaks both confidentiality and matching',
    );
  }

  if (config.KEK_RECOVERY_PUBLIC_KEY) {
    const pem = config.KEK_RECOVERY_PUBLIC_KEY;
    if (/PRIVATE KEY/.test(pem)) {
      // The whole point of the recovery key is that the server cannot use it.
      errors.push(
        'KEK_RECOVERY_PUBLIC_KEY contains a PRIVATE key. Only the public half may be configured — the private half must stay offline, or recovery gives no protection against a server compromise',
      );
    } else if (!/BEGIN (RSA )?PUBLIC KEY/.test(pem)) {
      errors.push('KEK_RECOVERY_PUBLIC_KEY must be a PEM-encoded public key');
    }
  } else if (isProduction) {
    errors.push(
      'KEK_RECOVERY_PUBLIC_KEY is required in production. Without it a data key has only one wrap, so losing ENCRYPTION_KEY loses the data — see docs/core/key-custody.md',
    );
  }

  return errors;
}

/**
 * True when the value decodes to exactly 32 bytes.
 *
 * `base64url` is accepted alongside `base64` and `hex` because it is what
 * `crypto.randomBytes(32).toString('base64url')` produces — a perfectly good
 * key that a base64-only check rejects over two substituted characters.
 */
function isThirtyTwoByteKey(value: string): boolean {
  const trimmed = value.trim();

  for (const encoding of ['base64', 'base64url', 'hex'] as const) {
    try {
      const buf = Buffer.from(trimmed, encoding);
      if (buf.length !== 32) continue;
      // Buffer.from silently drops invalid characters, so a passphrase can
      // decode to the right length by accident. Round-tripping catches it.
      const roundTrip = buf.toString(encoding);
      if (roundTrip.replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
        return true;
      }
    } catch {
      // try the next encoding
    }
  }

  return false;
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
