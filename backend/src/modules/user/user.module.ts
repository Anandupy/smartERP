import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { SecurityModule } from '@/common/services/security.module';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
