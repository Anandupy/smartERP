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

  const productionBase = {
    ...validBase,
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
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
          DATABASE_URL: 'postgresql://u:p@localhost:5432/erp_test?schema=public',
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
