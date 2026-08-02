import { Test, TestingModule } from '@nestjs/testing';
import { ContextResolverService } from '@/modules/context/services/context-resolver.service';
import { ContextValidatorService } from '@/modules/context/services/context-validator.service';
import { ContextDiscoveryService } from '@/modules/context/services/context-discovery.service';
import { ContextModule } from '@/modules/context/context.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RoleType } from '@/generated/client';

import { ConfigModule } from '@nestjs/config';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { SecurityModule } from '@/common/services/security.module';

describe('Enterprise Execution Context Platform (Integration)', () => {
  let resolver: ContextResolverService;
  let validator: ContextValidatorService;
  let discovery: ContextDiscoveryService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [envConfig, databaseConfig] }),
        SecurityModule,
        ContextModule,
      ],
    }).compile();

    resolver = moduleRef.get<ContextResolverService>(ContextResolverService);
    validator = moduleRef.get<ContextValidatorService>(ContextValidatorService);
    discovery = moduleRef.get<ContextDiscoveryService>(ContextDiscoveryService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('ContextModule components are correctly wired and injectable', () => {
    expect(resolver).toBeDefined();
    expect(validator).toBeDefined();
    expect(discovery).toBeDefined();
    expect(prisma).toBeDefined();
  });

  it('discovers contexts for SUPER_ADMIN role cleanly', async () => {
    const res = await discovery.discoverContexts('sa-id', RoleType.SUPER_ADMIN);
    expect(res).toBeDefined();
    expect(Array.isArray(res.availableOrganizations)).toBe(true);
    expect(Array.isArray(res.availableBranches)).toBe(true);
    expect(Array.isArray(res.availableAcademicYears)).toBe(true);
  });
});
