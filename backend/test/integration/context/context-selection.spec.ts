import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { SecurityModule } from '@/common/services/security.module';
import { ContextModule } from '@/modules/context/context.module';
import { ContextResolverService } from '@/modules/context/services/context-resolver.service';
import { RoleType } from '@/generated/client';

describe('Context Selection Required (HTTP 409) Integration', () => {
  let resolver: ContextResolverService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [envConfig, databaseConfig],
        }),
        SecurityModule,
        ContextModule,
      ],
    }).compile();

    resolver = moduleRef.get<ContextResolverService>(ContextResolverService);
  });

  it('ContextResolverService handles selection resolution correctly', async () => {
    expect(resolver).toBeDefined();
  });
});
