import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class BloodGroupService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'bloodGroup', ['applicants', 'students']);
  }
}
