import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '@/modules/user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { SecurityModule } from '@/common/services/security.module';
import { CommunicationModule } from '@/modules/communication/communication.module';

import { AuthorizationModule } from '@/modules/authorization/authorization.module';
import { ContextModule } from '@/modules/context/context.module';
import { WorkspaceSetupModule } from '@/modules/workspace/setup/workspace-setup.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    AuthorizationModule,
    ContextModule,
    WorkspaceSetupModule,
    PassportModule,
    SecurityModule,
    CommunicationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        // Guaranteed present by validateEnv; no fallback secret is acceptable here.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Format is validated by validateEnv (e.g. '15m', '1h', '7d').
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
