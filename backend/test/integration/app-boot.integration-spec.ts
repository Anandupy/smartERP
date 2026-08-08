import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';

/**
 * The application constructs under the test environment.
 *
 * Every other integration suite imports `AppModule`, so a provider that throws
 * during initialisation takes the whole run down before a single test reports —
 * which looks like an infrastructure problem rather than a code one. This suite
 * fails first and says what actually happened.
 */
describe('Application bootstrap', () => {
  it('builds every module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleRef.init();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
