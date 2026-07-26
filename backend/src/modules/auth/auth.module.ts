import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '@/modules/user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { SecurityModule } from '@/common/services/security.module';
import { CommunicationModule } from '@/modules/communication/communication.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    PassportModule,
    SecurityModule,
    CommunicationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
