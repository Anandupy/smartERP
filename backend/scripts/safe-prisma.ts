/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const command = args.join(' ');

// Forbidden commands outside of test environment
const destructiveCommands = ['migrate reset', 'db push', 'db drop', 'seed'];

const isDestructive = destructiveCommands.some((cmd) => command.includes(cmd));

const dbUrl = process.env.DATABASE_URL || '';

if (isDestructive) {
  console.log(
    `\n🛡️  Safety Wrapper: Inspecting Prisma command: prisma ${command}`,
  );

  if (
    process.env.NODE_ENV === 'production' ||
    dbUrl.toLowerCase().includes('prod')
  ) {
    console.error(
      `\n❌ FATAL: Refusing to run destructive Prisma command in production environment!`,
    );
    console.error(`Attempted command: prisma ${command}\n`);
    process.exit(1);
  }

  if (
    !dbUrl.includes('_test') &&
    !dbUrl.includes('localhost') &&
    !dbUrl.includes('127.0.0.1')
  ) {
    console.warn(
      `\n⚠️  WARNING: You are running a destructive command on a non-local database without '_test' in URL.`,
    );
    console.warn(`Ensure you know what you are doing. URL: ${dbUrl}\n`);
  }
}

try {
  execSync(`npx prisma ${command}`, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}
