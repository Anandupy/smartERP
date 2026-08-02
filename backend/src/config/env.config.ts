import { registerAs } from '@nestjs/config';

/**
 * Namespaced runtime configuration.
 *
 * No secret has a fallback here. Presence, format and strength are guaranteed
 * by `validateEnv` (src/config/env.validation.ts), which runs before this
 * factory is ever called, so a missing secret is a startup failure rather than
 * a silent substitution with a shared default value.
 */
export default registerAs('env', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  environment: process.env.NODE_ENV || 'development',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  corsOrigins: process.env.CORS_ORIGINS,
  trustProxy: process.env.TRUST_PROXY === 'true',

  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR,

  seedOnBootstrap: process.env.SEED_ON_BOOTSTRAP,
}));
