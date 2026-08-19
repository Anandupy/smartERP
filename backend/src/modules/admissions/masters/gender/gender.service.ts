import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class GenderService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'gender', [
      { relation: 'applicants', filterSoftDeleted: true },
      { relation: 'students', filterSoftDeleted: true },
    ]);
  }
}
