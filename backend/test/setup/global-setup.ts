import { validateAndSeedDb } from './test-db';
import { seedReferenceData } from './seed-reference-data';

export default async () => {
  console.log('\n[Global Setup] Starting test infrastructure validation...');
  await validateAndSeedDb();
  // Permissions, modules and menus. Without these every @RequirePermission
  // route answers 403 on a freshly migrated database.
  await seedReferenceData();
  console.log('[Global Setup] Test infrastructure validated successfully.\n');
};
