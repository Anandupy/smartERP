import { closeDbConnection } from './test-db';

export default async () => {
  console.log('\n[Global Teardown] Closing database connection...');
  await closeDbConnection();
};
