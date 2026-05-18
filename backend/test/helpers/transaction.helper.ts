import { PrismaClient } from '../../prisma/generated';

/**
 * Runs a test inside a transaction and automatically rolls it back.
 * This is our primary safe test execution strategy for integration tests.
 *
 * @param prisma The PrismaClient instance
 * @param testFn The test logic to execute
 */
export async function runInTransaction(
  prisma: PrismaClient,
  testFn: (tx: any) => Promise<void>,
) {
  const ROLLBACK_MESSAGE = 'ROLLBACK_SAFE_TEST_TRANSACTION';
  try {
    await prisma.$transaction(async (tx) => {
      await testFn(tx);
      // Always throw to force a rollback after test succeeds
      throw new Error(ROLLBACK_MESSAGE);
    });
  } catch (error) {
    if (error instanceof Error && error.message === ROLLBACK_MESSAGE) {
      // This is the expected rollback
      return;
    }
    // If it's a real error, throw it so the test fails
    throw error;
  }
}
