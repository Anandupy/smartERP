/**
 * Fails if the migration history and `schema.prisma` have diverged.
 *
 * The history once fell 34 tables behind the schema without anything noticing,
 * because development used `prisma db push` and CI pushed the schema too — so
 * nothing ever executed the migrations. This check is what makes that
 * impossible to repeat: it is run in CI immediately after `migrate deploy`, and
 * can be run locally at any time.
 *
 *   pnpm migrate:verify
 *
 * Written in TypeScript rather than inline shell so it behaves identically on
 * a Windows workstation and a Linux runner.
 */
import { execFileSync } from 'child_process';

const EMPTY_DIFF = 'This is an empty migration.';

function main(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  let diff: string;

  try {
    diff = execFileSync(
      'npx',
      [
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        databaseUrl,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true },
    );
  } catch (error) {
    console.error('Failed to compute the migration diff.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
  }

  if (diff.includes(EMPTY_DIFF)) {
    console.log('✅ Migrations match schema.prisma — no drift.');
    return;
  }

  console.error(
    '❌ Schema drift detected: the database reached by migrations does not match schema.prisma.\n',
  );
  console.error(diff);
  console.error(
    '\nGenerate a migration for the difference rather than using `prisma db push`:\n' +
      '  pnpm prisma:migrate:dev -- --name <describe_the_change>\n',
  );
  process.exit(1);
}

main();
