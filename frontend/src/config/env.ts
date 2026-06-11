// ============================================================
// Environment Configuration — Validated at startup
// ============================================================

/**
 * Validated environment configuration.
 * Access env variables ONLY through this object, never directly.
 */
function getEnvVar(key: string, fallback?: string): string {
  let value: string | undefined;
  switch (key) {
    case 'NEXT_PUBLIC_API_URL':
      value = process.env.NEXT_PUBLIC_API_URL;
      break;
    case 'NEXT_PUBLIC_APP_URL':
      value = process.env.NEXT_PUBLIC_APP_URL;
      break;
    case 'NEXT_PUBLIC_APP_NAME':
      value = process.env.NEXT_PUBLIC_APP_NAME;
      break;
    case 'NEXT_PUBLIC_ENABLE_DEVTOOLS':
      value = process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS;
      break;
    case 'NEXT_PUBLIC_ENABLE_TOURS':
      value = process.env.NEXT_PUBLIC_ENABLE_TOURS;
      break;
    default:
      value = process.env[key];
  }
  value = value ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  /** Backend API base URL — injected into all Axios requests */
  apiUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:3000/v1'),

  /** Frontend app URL */
  appUrl: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3001'),

  /** App display name */
  appName: getEnvVar('NEXT_PUBLIC_APP_NAME', 'EduOS'),

  /** Enable React Query devtools */
  enableDevtools: getEnvVar('NEXT_PUBLIC_ENABLE_DEVTOOLS', 'false') === 'true',

  /** Enable Driver.js tours */
  enableTours: getEnvVar('NEXT_PUBLIC_ENABLE_TOURS', 'true') === 'true',

  /** Current environment */
  isDev: process.env['NODE_ENV'] === 'development',
  isProd: process.env['NODE_ENV'] === 'production',
  isTest: process.env['NODE_ENV'] === 'test',
} as const;
