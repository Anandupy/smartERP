export function validateTestEnvironment() {
  const nodeEnv = process.env.NODE_ENV;
  const dbUrl = process.env.DATABASE_URL || '';

  if (nodeEnv !== 'test') {
    throw new Error(
      `\n❌ FATAL: Refusing to run tests outside NODE_ENV=test. Current: ${nodeEnv}\n`,
    );
  }

  if (!dbUrl) {
    throw new Error(`\n❌ FATAL: DATABASE_URL is not set.\n`);
  }

  if (!dbUrl.includes('_test')) {
    throw new Error(
      `\n❌ FATAL: DATABASE_URL must contain '_test' for safety. Current: ${dbUrl}\n`,
    );
  }

  const lowerUrl = dbUrl.toLowerCase();
  const forbiddenKeywords = ['prod', 'production', 'live', 'main'];

  for (const keyword of forbiddenKeywords) {
    if (lowerUrl.includes(keyword)) {
      throw new Error(
        `\n❌ FATAL: Unsafe database detected. Database URL contains forbidden keyword '${keyword}'.\n`,
      );
    }
  }

  // Extract DB name
  let dbName = 'unknown';
  try {
    const urlParts = new URL(dbUrl);
    dbName = urlParts.pathname.replace('/', '');
  } catch (e) {
    // ignore parsing errors
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠ TEST ENVIRONMENT ACTIVE');
  console.log(`Database: ${dbName}`);
  console.log(`Environment: ${nodeEnv}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
