import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BaseMasterService } from '../base-master.service';

@Injectable()
export class RelationTypeService extends BaseMasterService {
  constructor(prisma: PrismaService) {
    super(prisma, 'relationType', [
      // ApplicantGuardianMapping has no `deletedAt` of its own — the mapping
      // row's existence *is* the reference; removing it is how the reference
      // ends (see GuardiansService.removeMapping).
      { relation: 'mappings', filterSoftDeleted: false },
      // Guardianship (Person<->Person) is append-only and never deleted, even
      // once `endedAt` is set — module doc §5: it stays as a permanent
      // historical fact (a past sibling relationship, a lapsed authorised
      // contact). So it always blocks, regardless of whether it is still
      // active.
      { relation: 'guardianships', filterSoftDeleted: false },
    ]);
  }
}
