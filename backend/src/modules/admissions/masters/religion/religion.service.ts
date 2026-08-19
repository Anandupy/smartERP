import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class ReligionService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'religion', [
      { relation: 'applicants', filterSoftDeleted: true },
      { relation: 'students', filterSoftDeleted: true },
    ]);
  }
}
