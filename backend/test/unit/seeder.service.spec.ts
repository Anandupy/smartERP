import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SeederService } from '@/infrastructure/database/seeder.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';

describe('SeederService bootstrap gate', () => {
  let service: SeederService;
  let runSpy: jest.SpyInstance;

  const env: Record<string, string | boolean | undefined> = {};

  const build = async (
    values: Record<string, string | boolean | undefined>,
  ) => {
    Object.keys(env).forEach((k) => delete env[k]);
    Object.assign(env, values);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeederService,
        { provide: PrismaService, useValue: {} },
        { provide: PasswordService, useValue: { hash: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    service = module.get<SeederService>(SeederService);
    runSpy = jest.spyOn(service, 'run').mockResolvedValue(undefined);
  };

  afterEach(() => jest.restoreAllMocks());

  it('never seeds in production', async () => {
    await build({ NODE_ENV: 'production' });

    await service.onApplicationBootstrap();

    // Automatic seeding would create a privileged account from environment
    // credentials on every production deploy.
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('does not seed in production even if SEED_ON_BOOTSTRAP is true', async () => {
    await build({ NODE_ENV: 'production', SEED_ON_BOOTSTRAP: 'true' });

    await service.onApplicationBootstrap();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it('seeds in development when the variable is unset', async () => {
    await build({ NODE_ENV: 'development' });

    await service.onApplicationBootstrap();

    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('honours SEED_ON_BOOTSTRAP=false outside production', async () => {
    await build({ NODE_ENV: 'test', SEED_ON_BOOTSTRAP: 'false' });

    await service.onApplicationBootstrap();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it('honours a boolean false, which is what ConfigService actually returns', async () => {
    // validateEnv coerces the variable, so the value reaching the seeder is a
    // boolean. Comparing only against the string silently re-enabled seeding
    // in every environment that had switched it off.
    await build({ NODE_ENV: 'test', SEED_ON_BOOTSTRAP: false });

    await service.onApplicationBootstrap();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it('still seeds when the flag is explicitly true', async () => {
    await build({ NODE_ENV: 'development', SEED_ON_BOOTSTRAP: true });

    await service.onApplicationBootstrap();

    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});
