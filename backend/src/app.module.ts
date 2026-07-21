import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { LoggerModule } from '@/common/logger/logger.module';
import { RequestContextMiddleware } from '@/common/logger/request-context.middleware';

import { AuthModule } from '@/modules/auth/auth.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { BranchModule } from '@/modules/branch/branch.module';
import { UserModule } from '@/modules/user/user.module';
import { AcademicYearModule } from '@/modules/academic-year/academic-year.module';
import { ProgramModule } from '@/modules/program/program.module';
import { AcademicUnitModule } from '@/modules/academic-unit/academic-unit.module';
import { SecurityModule } from '@/common/services/security.module';
import { AdmissionsModule } from '@/modules/admissions/admissions.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { BranchGuard } from '@/common/guards/branch.guard';
import { AcademicYearGuard } from '@/common/guards/academic-year.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig, databaseConfig],
      envFilePath: '.env',
    }),
    LoggerModule,
    PrismaModule,
    SecurityModule,
    AuthModule,
    UserModule,
    SystemSettingsModule,
    OrganizationModule,
    BranchModule,
    AcademicYearModule,
    ProgramModule,
    AcademicUnitModule,
    AdmissionsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BranchGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AcademicYearGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
