import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class AdmissionSourceService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'admissionSource', [
      { relation: 'applicants', filterSoftDeleted: true },
      { relation: 'admissions', filterSoftDeleted: true },
    ]);
  }
}
