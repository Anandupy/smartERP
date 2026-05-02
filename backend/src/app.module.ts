import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import envConfig from '@/config/env.config';
import databaseConfig from '@/config/database.config';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { LoggerModule } from '@/infrastructure/logger/logger.module';
import { RequestContextMiddleware } from '@/middleware/request-context.middleware';

import { AuthModule } from '@/modules/auth/auth.module';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { OrganizationModule } from '@/modules/organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig, databaseConfig],
      envFilePath: '.env',
    }),
    LoggerModule,
    PrismaModule,
    AuthModule,
    SystemSettingsModule,
    OrganizationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
