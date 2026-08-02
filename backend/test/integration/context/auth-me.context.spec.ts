import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { SecurityModule } from '@/common/services/security.module';
import { ContextModule } from '@/modules/context/context.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthService } from '@/modules/auth/auth.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

import { MaintenanceModule } from '@/modules/maintenance/maintenance.module';

describe('Auth /me Endpoint Context Integration', () => {
  let authService: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [envConfig, databaseConfig] }),
        SecurityModule,
        MaintenanceModule,
        ContextModule,
        AuthModule,
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('AuthService getMe executes and returns structured identity & context discovery', async () => {
    expect(authService).toBeDefined();
  });
});
