import { truncateDb, reSeedBaseData } from './test-db';

export default async () => {
  console.log('\n[Global Setup] Starting database preparation...');
  await truncateDb();
  await reSeedBaseData();
  console.log('[Global Setup] Database prepared with realistic ERP data.\n');
};
