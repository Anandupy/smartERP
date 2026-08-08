import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { SeederService } from './seeder.service';
import { RowLockService } from './row-lock.service';

@Global()
@Module({
  providers: [PrismaService, SeederService, RowLockService],
  exports: [PrismaService, SeederService, RowLockService],
})
export class PrismaModule {}
