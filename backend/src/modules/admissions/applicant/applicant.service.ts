import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import {
  ApplicantCreatedEvent,
  ApplicantDeletedEvent,
  ApplicantUpdatedEvent,
} from '@/common/events';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';
import { AdmissionApplicationStatus } from '@/generated/client';
import {
  CreateApplicantDto,
  QueryApplicantDto,
  UpdateApplicantDto,
} from './dto/applicant.dto';

/**
 * Statuses that freeze an applicant against direct edits.
 *
 * Everything from the offer onward: once a seat has been offered the record is
 * evidence, and after `ADMITTED` it has already produced a Student.
 */
const FROZEN_STATUSES: AdmissionApplicationStatus[] = [
  'APPROVED',
  'SEAT_CONFIRMED',
  'ADMITTED',
  'DEFERRED',
  'REJECTED',
  'WITHDRAWN',
  'CANCELLED',
];

@Injectable()
export class ApplicantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly eventBus: EventBus,
    private readonly outbox: OutboxPublisher,
  ) {}

  private getDisplayName(
    firstName: string,
    middleName: string | undefined,
    lastName: string,
  ): string {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
  }

  async checkDuplicates(
    data: {
      aadhaarNo?: string;
      primaryMobile: string;
      firstName: string;
      lastName: string;
      dob: string;
    },
    scope: ResourceScope,
  ) {
    const matches = await this.prisma.applicant.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        deletedAt: null,
        OR: [
          ...(data.aadhaarNo ? [{ aadhaarNo: data.aadhaarNo }] : []),
          { primaryMobile: data.primaryMobile },
          {
            AND: [
              {
                firstName: {
                  equals: data.firstName,
                  mode: 'insensitive',
                } as any,
              },
              {
                lastName: { equals: data.lastName, mode: 'insensitive' } as any,
              },
              { dob: new Date(data.dob) },
            ],
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        primaryMobile: true,
        admissionStatus: true,
      },
    });

    return { hasDuplicates: matches.length > 0, matches };
  }

  /**
   * Register an applicant.
   *
   * Number allocation and the insert now share one transaction. Previously the
   * two form numbers were allocated first and the row inserted afterwards with
   * no transaction between them, so a validation failure or a crash burned both
   * numbers permanently.
   *
   * Both purposes are MONOTONIC, so the allocation still commits on its own
   * connection and never holds the counter for the length of this transaction —
   * a rollback here leaves a gap, which is the accepted trade for not
   * serialising every registration at the branch.
   */
  async create(dto: CreateApplicantDto, scope: ResourceScope, userId?: string) {
    const dobDate = new Date(dto.dob);

    await this.assertMasterReferencesExist(dto);
    if (dto.programId) {
      await this.assertProgramInBranch(dto.programId, scope.branchId);
    }

    const duplicateReport = await this.checkDuplicates(
      {
        aadhaarNo: dto.aadhaarNo,
        primaryMobile: dto.primaryMobile,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: dto.dob,
      },
      scope,
    );

    const displayName = this.getDisplayName(
      dto.firstName,
      dto.middleName,
      dto.lastName,
    );

    const applicant = await this.prisma.$transaction(async (tx) => {
      const formNo = await this.numberingService.allocate(
        {
          purpose: 'ADMISSION_FORM',
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          academicYearId: scope.academicYearId,
        },
        tx,
      );
      const appNo = await this.numberingService.allocate(
        {
          purpose: 'APPLICATION',
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          academicYearId: scope.academicYearId,
        },
        tx,
      );

      const created = await tx.applicant.create({
        data: {
          ...dto,
          dob: dobDate,
          displayName,
          admissionFormNo: formNo,
          applicationNo: appNo,
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          academicYearId: scope.academicYearId!,
          createdBy: userId,
          admissionStatus: 'DRAFT',
        },
      });

      await this.outbox.enqueue(
        new ApplicantCreatedEvent({
          applicantId: created.id,
          displayName: created.displayName,
          admissionFormNo: created.admissionFormNo,
          applicationNo: created.applicationNo,
          primaryMobile: created.primaryMobile,
        }),
        tx,
      );

      return created;
    });

    return {
      applicant,
      warnings: duplicateReport.hasDuplicates ? duplicateReport.matches : [],
    };
  }

  /**
   * Read one applicant **within the caller's scope**.
   *
   * The scope is part of the lookup, not a check performed afterwards. A row
   * belonging to another organization or branch is simply not found — and the
   * caller cannot distinguish that from an id that does not exist, which is
   * deliberate.
   */
  async findOne(id: string, scope: ResourceScope) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id, ...scopedWhere(scope), deletedAt: null },
      include: {
        gender: true,
        religion: true,
        caste: true,
        category: true,
        motherTongue: true,
        bloodGroup: true,
        disabilityType: true,
        admissionSource: true,
        quota: true,
        guardians: { include: { guardian: true, relationType: true } },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }
    return applicant;
  }

  /**
   * Correct an applicant's declared details.
   *
   * The write re-asserts the scope in its own `WHERE` rather than trusting the
   * preceding read. A read-then-write-by-id is only as safe as the read, and it
   * is one refactor away from losing the scope entirely.
   */
  async update(
    id: string,
    dto: UpdateApplicantDto,
    scope: ResourceScope,
    userId?: string,
  ) {
    const applicant = await this.findOne(id, scope);

    if (FROZEN_STATUSES.includes(applicant.admissionStatus)) {
      throw new ForbiddenException(
        `Cannot modify applicant in status ${applicant.admissionStatus}`,
      );
    }

    if (dto.programId) {
      await this.assertProgramInBranch(dto.programId, scope.branchId);
    }

    const updatedData: any = { ...dto, updatedBy: userId };

    if (dto.dob) {
      updatedData.dob = new Date(dto.dob);
    }

    if (
      dto.firstName !== undefined ||
      dto.middleName !== undefined ||
      dto.lastName !== undefined
    ) {
      updatedData.displayName = this.getDisplayName(
        dto.firstName ?? applicant.firstName,
        dto.middleName !== undefined
          ? dto.middleName
          : (applicant.middleName ?? undefined),
        dto.lastName ?? applicant.lastName,
      );
    }

    const updatedApplicant = await this.prisma.$transaction(async (tx) => {
      const result = await tx.applicant.updateMany({
        where: { id, ...scopedWhere(scope), deletedAt: null },
        data: updatedData,
      });

      if (result.count !== 1) {
        throw new NotFoundException('Applicant not found');
      }

      const row = await tx.applicant.findFirstOrThrow({ where: { id } });

      await this.outbox.enqueue(
        new ApplicantUpdatedEvent({
          applicantId: row.id,
          displayName: row.displayName,
        }),
        tx,
      );

      return row;
    });

    return updatedApplicant;
  }

  async findAll(query: QueryApplicantDto, scope: ResourceScope) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const whereClause: any = {
      ...scopedWhere(scope, { includeAcademicYear: true }),
      deletedAt: null,
    };

    if (query.status) {
      whereClause.admissionStatus = query.status;
    }

    if (query.search) {
      whereClause.OR = [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { primaryMobile: { contains: query.search } },
        { applicationNo: { contains: query.search, mode: 'insensitive' } },
        { admissionFormNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.applicant.count({ where: whereClause }),
      this.prisma.applicant.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { gender: true, admissionSource: true, quota: true },
      }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async remove(id: string, scope: ResourceScope, userId?: string) {
    const applicant = await this.findOne(id, scope);

    if (FROZEN_STATUSES.includes(applicant.admissionStatus)) {
      throw new ForbiddenException(
        `Cannot delete applicant in status ${applicant.admissionStatus}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.applicant.updateMany({
        where: { id, ...scopedWhere(scope), deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: userId },
      });

      if (result.count !== 1) {
        throw new NotFoundException('Applicant not found');
      }

      await this.outbox.enqueue(
        new ApplicantDeletedEvent({ applicantId: id }),
        tx,
      );

      return { id };
    });
  }

  /**
   * The programme applied for must belong to the applicant's own branch.
   *
   * Checked for belonging, not existence. A programme id that merely resolves
   * lets an application be filed against another branch's offering, which is
   * the same reference hole as an out-of-scope applicant id — and it would then
   * flow into the Admission that Phase 5 opens from it.
   */
  private async assertProgramInBranch(
    programId: string,
    branchId: string,
  ): Promise<void> {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, isDeleted: false },
      select: { id: true, branchId: true, isActive: true },
    });

    if (!program) {
      throw new NotFoundException({
        error: 'PROGRAM_NOT_FOUND',
        message: 'The selected programme does not exist.',
      });
    }
    if (program.branchId !== branchId) {
      throw new BadRequestException({
        error: 'PROGRAM_OUT_OF_SCOPE',
        message: 'The selected programme belongs to another branch.',
      });
    }
    if (!program.isActive) {
      throw new BadRequestException({
        error: 'PROGRAM_NOT_ACTIVE',
        message: 'The selected programme is not active.',
      });
    }
  }

  private async assertMasterReferencesExist(
    dto: CreateApplicantDto,
  ): Promise<void> {
    const checks: Array<[string | undefined, string, () => Promise<unknown>]> =
      [
        [
          dto.genderId,
          'Gender',
          () =>
            this.prisma.gender.findFirst({
              where: { id: dto.genderId, deletedAt: null },
            }),
        ],
        [
          dto.religionId,
          'Religion',
          () =>
            this.prisma.religion.findFirst({
              where: { id: dto.religionId, deletedAt: null },
            }),
        ],
        [
          dto.casteId,
          'Caste',
          () =>
            this.prisma.caste.findFirst({
              where: { id: dto.casteId, deletedAt: null },
            }),
        ],
        [
          dto.categoryId,
          'Category',
          () =>
            this.prisma.category.findFirst({
              where: { id: dto.categoryId, deletedAt: null },
            }),
        ],
        [
          dto.motherTongueId,
          'Mother Tongue Language',
          () =>
            this.prisma.language.findFirst({
              where: { id: dto.motherTongueId, deletedAt: null },
            }),
        ],
        [
          dto.bloodGroupId,
          'Blood Group',
          () =>
            this.prisma.bloodGroup.findFirst({
              where: { id: dto.bloodGroupId, deletedAt: null },
            }),
        ],
        [
          dto.disabilityTypeId,
          'Disability Type',
          () =>
            this.prisma.disability.findFirst({
              where: { id: dto.disabilityTypeId, deletedAt: null },
            }),
        ],
        [
          dto.admissionSourceId,
          'Admission Source',
          () =>
            this.prisma.admissionSource.findFirst({
              where: { id: dto.admissionSourceId, deletedAt: null },
            }),
        ],
        [
          dto.quotaId,
          'Quota',
          () =>
            this.prisma.quota.findFirst({
              where: { id: dto.quotaId, deletedAt: null },
            }),
        ],
      ];

    for (const [value, label, lookup] of checks) {
      if (!value) continue;
      const exists = await lookup();
      if (!exists) {
        throw new NotFoundException(`${label} with ID ${value} not found`);
      }
    }
  }
}
