import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class QuotaService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'quota', ['applicants', 'admissions']);
  }
}
