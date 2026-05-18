import { validateAndSeedDb } from './test-db';

export default async () => {
  console.log('\n[Global Setup] Starting test infrastructure validation...');
  await validateAndSeedDb();
  console.log('[Global Setup] Test infrastructure validated successfully.\n');
};
