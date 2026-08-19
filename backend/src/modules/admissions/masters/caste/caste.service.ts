import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class CasteService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'caste', [
      { relation: 'applicants', filterSoftDeleted: true },
      { relation: 'students', filterSoftDeleted: true },
    ]);
  }
}
