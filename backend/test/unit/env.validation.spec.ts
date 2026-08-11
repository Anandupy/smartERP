import { validateEnv, NodeEnvironment } from '@/config/env.validation';

/**
 * The environment contract is a security boundary: it is the only thing
 * standing between a typo in a deployment pipeline and an API running on a
 * publicly known JWT secret. These tests pin the rules that must never regress.
 */
describe('validateEnv', () => {
  const validBase = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/erp',
    JWT_SECRET: 'a-sufficiently-long-development-secret-value',
    JWT_REFRESH_SECRET: 'a-different-sufficiently-long-refresh-secret',
  };

  /**
   * A 32-byte key and a PEM public key, so the identity-crypto rules in
   * `productionBase` are satisfied by something realistic rather than by a
   * string that happens to be long.
   */
  const VALID_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const VALID_PEPPER = Buffer.alloc(48, 11).toString('base64');
  const VALID_RECOVERY_PUBLIC_KEY = [
    '-----BEGIN PUBLIC KEY-----',
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAexample',
    '-----END PUBLIC KEY-----',
  ].join('\n');

  const productionBase = {
    ...validBase,
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
    // Required in production as of Phase 1: sensitive identity data cannot be
    // stored without a key, matched without a pepper, or recovered without the
    // public half of the recovery keypair.
    ENCRYPTION_KEY: VALID_ENCRYPTION_KEY,
    IDENTITY_HASH_PEPPER: VALID_PEPPER,
    KEK_RECOVERY_PUBLIC_KEY: VALID_RECOVERY_PUBLIC_KEY,
  };

  describe('accepts valid configuration', () => {
    it('accepts a minimal development configuration', () => {
      const config = validateEnv({ ...validBase });

      expect(config.NODE_ENV).toBe(NodeEnvironment.Development);
      expect(config.PORT).toBe(3000);
      expect(config.JWT_EXPIRES_IN).toBe('15m');
    });

    it('accepts a valid production configuration', () => {
      expect(() => validateEnv({ ...productionBase })).not.toThrow();
    });

    it('coerces numeric and boolean strings from the environment', () => {
      const config = validateEnv({
        ...validBase,
        PORT: '8080',
        THROTTLE_LIMIT: '55',
        THROTTLE_ENABLED: 'false',
      });

      expect(config.PORT).toBe(8080);
      expect(config.THROTTLE_LIMIT).toBe(55);
      expect(config.THROTTLE_ENABLED).toBe(false);
    });
  });

  describe('rejects missing required values', () => {
    it('rejects a missing DATABASE_URL', () => {
      const { DATABASE_URL: _omitted, ...rest } = validBase;
      expect(() => validateEnv(rest)).toThrow(/DATABASE_URL is required/);
    });

    it('rejects a DATABASE_URL that is not a postgres connection string', () => {
      expect(() =>
        validateEnv({ ...validBase, DATABASE_URL: 'mysql://localhost/erp' }),
      ).toThrow(/must be a postgresql:\/\/ connection string/);
    });

    it('rejects a missing JWT_SECRET', () => {
      const { JWT_SECRET: _omitted, ...rest } = validBase;
      expect(() => validateEnv(rest)).toThrow(/JWT_SECRET is required/);
    });

    it('rejects a missing JWT_REFRESH_SECRET', () => {
      const { JWT_REFRESH_SECRET: _omitted, ...rest } = validBase;
      expect(() => validateEnv(rest)).toThrow(/JWT_REFRESH_SECRET is required/);
    });
  });

  describe('rejects insecure secrets', () => {
    it.each([
      'default-secret',
      'super-secret',
      'changeme',
      'secret',
      'your-secret-key',
    ])('rejects the well-known placeholder %s', (placeholder) => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: placeholder }),
      ).toThrow(/well-known placeholder/);
    });

    it('rejects placeholders case-insensitively', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: 'Super-Secret' }),
      ).toThrow(/well-known placeholder/);
    });

    it('rejects a short secret in production', () => {
      expect(() =>
        validateEnv({ ...productionBase, JWT_SECRET: 'short' }),
      ).toThrow(/JWT_SECRET must be at least 32 characters/);
    });

    it('tolerates a short secret outside production', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_SECRET: 'short-dev-secret' }),
      ).not.toThrow();
    });

    it('rejects reusing one secret for both access and refresh tokens', () => {
      expect(() =>
        validateEnv({
          ...validBase,
          JWT_REFRESH_SECRET: validBase.JWT_SECRET,
        }),
      ).toThrow(/must be different values/);
    });
  });

  describe('production-specific rules', () => {
    it('requires CORS_ORIGINS in production', () => {
      const { CORS_ORIGINS: _omitted, ...rest } = productionBase;
      expect(() => validateEnv(rest)).toThrow(/CORS_ORIGINS is required/);
    });

    it('refuses bootstrap seeding in production', () => {
      expect(() =>
        validateEnv({ ...productionBase, SEED_ON_BOOTSTRAP: 'true' }),
      ).toThrow(/must not be enabled in production/);
    });

    it('refuses a _test database in production', () => {
      expect(() =>
        validateEnv({
          ...productionBase,
          DATABASE_URL:
            'postgresql://u:p@localhost:5432/erp_test?schema=public',
        }),
      ).toThrow(/points at a _test database/);
    });
  });

  describe('cross-field rules', () => {
    it('requires admin credentials when seeding is explicitly enabled', () => {
      expect(() =>
        validateEnv({ ...validBase, SEED_ON_BOOTSTRAP: 'true' }),
      ).toThrow(/ADMIN_EMAIL and ADMIN_PASSWORD are not both set/);
    });

    it('accepts explicit seeding when admin credentials are present', () => {
      expect(() =>
        validateEnv({
          ...validBase,
          SEED_ON_BOOTSTRAP: 'true',
          ADMIN_EMAIL: 'admin@example.com',
          ADMIN_PASSWORD: 'AdminPassword123!',
        }),
      ).not.toThrow();
    });
  });

  describe('format rules', () => {
    it('rejects an out-of-range PORT', () => {
      expect(() => validateEnv({ ...validBase, PORT: '99999' })).toThrow();
    });

    it('rejects a malformed token lifetime', () => {
      expect(() =>
        validateEnv({ ...validBase, JWT_EXPIRES_IN: 'fifteen-minutes' }),
      ).toThrow(/JWT_EXPIRES_IN must look like/);
    });

    it('rejects an unknown LOG_LEVEL', () => {
      expect(() => validateEnv({ ...validBase, LOG_LEVEL: 'verbose' })).toThrow(
        /LOG_LEVEL must be one of/,
      );
    });

    it('rejects an unknown NODE_ENV', () => {
      expect(() => validateEnv({ ...validBase, NODE_ENV: 'staging' })).toThrow(
        /NODE_ENV must be one of/,
      );
    });
  });

  describe('identity crypto configuration', () => {
    it('requires a key, a pepper and a recovery public key in production', () => {
      for (const omitted of [
        'ENCRYPTION_KEY',
        'IDENTITY_HASH_PEPPER',
        'KEK_RECOVERY_PUBLIC_KEY',
      ]) {
        const config: Record<string, unknown> = { ...productionBase };
        delete config[omitted];
        expect(() => validateEnv(config)).toThrow(new RegExp(omitted));
      }
    });

    it('tolerates their absence outside production', () => {
      expect(() => validateEnv({ ...validBase })).not.toThrow();
    });

    it('accepts a 32-byte key in base64, base64url or hex', () => {
      const raw = Buffer.alloc(32, 3);
      for (const encoding of ['base64', 'base64url', 'hex'] as const) {
        expect(() =>
          validateEnv({ ...validBase, ENCRYPTION_KEY: raw.toString(encoding) }),
        ).not.toThrow();
      }
    });

    it('rejects a long passphrase posing as a key', () => {
      // 43 characters — the same length as unpadded base64 of 32 bytes, and the
      // shape a naive length check waves through.
      expect(() =>
        validateEnv({
          ...validBase,
          ENCRYPTION_KEY: 'correct horse battery staple correct horse!',
        }),
      ).toThrow(/exactly 32 bytes/);
    });

    it('rejects a private key where the public half belongs', () => {
      expect(() =>
        validateEnv({
          ...productionBase,
          KEK_RECOVERY_PUBLIC_KEY:
            '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
        }),
      ).toThrow(/PRIVATE key/);
    });

    it('refuses one secret used for two purposes', () => {
      expect(() =>
        validateEnv({
          ...productionBase,
          IDENTITY_HASH_PEPPER: productionBase.ENCRYPTION_KEY,
        }),
      ).toThrow(/must be different values/);
    });

    it('never echoes a rejected secret back in the error', () => {
      const secret = 'this-is-not-a-valid-key-but-is-long-enough!';
      try {
        validateEnv({ ...validBase, ENCRYPTION_KEY: secret });
        throw new Error('expected validateEnv to throw');
      } catch (error) {
        expect((error as Error).message).not.toContain(secret);
      }
    });
  });

  it('reports every problem at once rather than one per restart', () => {
    const { DATABASE_URL: _a, JWT_SECRET: _b, ...rest } = validBase;

    try {
      validateEnv({ ...rest, PORT: 'not-a-number' });
      throw new Error('expected validateEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/DATABASE_URL/);
      expect(message).toMatch(/JWT_SECRET/);
      expect(message).toMatch(/PORT/);
    }
  });
});
