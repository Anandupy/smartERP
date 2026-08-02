import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { validateEnv } from '@/config/env.validation';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventsModule } from '@/infrastructure/events/events.module';
import { AuditModule } from '@/infrastructure/audit/audit.module';
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
import { MaintenanceModule } from '@/modules/maintenance/maintenance.module';
import { MaintenanceGuard } from '@/common/guards/maintenance.guard';
import { CommunicationModule } from '@/modules/communication/communication.module';

import { AuthorizationModule } from '@/modules/authorization/authorization.module';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { WorkspaceModule } from '@/modules/workspace/workspace.module';
import { ContextModule } from '@/modules/context/context.module';
import { ExecutionContextGuard } from '@/modules/context/guards/execution-context.guard';
import { WorkspaceSetupGuard } from '@/common/guards/workspace-setup.guard';
import { WorkspaceSetupModule } from '@/modules/workspace/setup/workspace-setup.module';
import { ThrottlingModule } from '@/common/throttling/throttling.module';
import { HealthModule } from '@/modules/health/health.module';
import { PublicRouteThrottlerGuard } from '@/common/throttling/public-route-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig, databaseConfig],
      envFilePath: '.env',
      // Fail fast: a misconfigured deployment must never reach the first request.
      validate: validateEnv,
    }),
    LoggerModule,
    ThrottlingModule,
    HealthModule,
    PrismaModule,
    EventsModule,
    AuditModule,
    SecurityModule,
    AuthModule,
    UserModule,
    AuthorizationModule,
    ContextModule,
    WorkspaceModule,
    WorkspaceSetupModule,
    SystemSettingsModule,
    OrganizationModule,
    BranchModule,
    AcademicYearModule,
    ProgramModule,
    AcademicUnitModule,
    AdmissionsModule,
    MaintenanceModule,
    CommunicationModule,
  ],
  controllers: [],
  // Global guards execute in registration order. The order below is the
  // pipeline contract documented in docs/core/guard-pipeline.md:
  // authenticate, then establish scope, then authorize against that scope,
  // then assert the scope satisfies the route's requirements.
  providers: [
    // 0. Rate limiting — runs first so an abusive caller is rejected before any
    //    database work happens. Inert on authenticated routes.
    {
      provide: APP_GUARD,
      useClass: PublicRouteThrottlerGuard,
    },
    // 1. Authentication — establishes request.user.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 2. Bootstrap gate — blocks the ordinary API until setup completes, so a
    //    fresh install fails with an actionable SETUP_REQUIRED instead of a
    //    misleading context-resolution error.
    {
      provide: APP_GUARD,
      useClass: WorkspaceSetupGuard,
    },
    // 3. Execution context — the only writer of identity and tenant scope.
    {
      provide: APP_GUARD,
      useClass: ExecutionContextGuard,
    },
    // 4. Authorization — decides against the resolved scope.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    // 4. Availability — maintenance windows are scoped by the resolved context.
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    // 5. Route scope requirements — assertions over the resolved context.
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
