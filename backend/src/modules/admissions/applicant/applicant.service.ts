import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  QueryApplicantDto,
} from './dto/applicant.dto';

@Injectable()
export class ApplicantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  private getDisplayName(
    firstName: string,
    middleName: string | undefined,
    lastName: string,
  ): string {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
  }

  // Auto-init numbering config if missing, to prevent runtime failures in tests
  private async ensureNumberConfig(
    branchId: string,
    orgId: string,
    purpose: string,
  ) {
    const config = await this.prisma.numberSequenceConfig.findUnique({
      where: { branchId_purpose: { branchId, purpose } },
    });

    if (!config) {
      await this.prisma.numberSequenceConfig.create({
        data: {
          organizationId: orgId,
          branchId,
          purpose,
          prefix: purpose === 'ADMISSION_FORM' ? 'ADM' : 'APP',
          sequencePadding: 4,
          format: '{prefix}-{year}-{sequence}',
          includeAcademicYear: true,
          resetStrategy: 'YEARLY',
        },
      });
    }
  }

  async checkDuplicates(
    data: {
      aadhaarNo?: string;
      primaryMobile: string;
      firstName: string;
      lastName: string;
      dob: string;
    },
    branchId: string,
  ) {
    const matches = await this.prisma.applicant.findMany({
      where: {
        branchId,
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
        aadhaarNo: true,
        admissionStatus: true,
      },
    });

    return {
      hasDuplicates: matches.length > 0,
      matches,
    };
  }

  async create(
    dto: CreateApplicantDto,
    orgId: string,
    branchId: string,
    academicYearId: string,
    userId?: string,
  ) {
    const dobDate = new Date(dto.dob);

    // 1. Verify Master References exist if IDs are provided
    if (dto.genderId) {
      const exists = await this.prisma.gender.findFirst({
        where: { id: dto.genderId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(`Gender with ID ${dto.genderId} not found`);
    }
    if (dto.religionId) {
      const exists = await this.prisma.religion.findFirst({
        where: { id: dto.religionId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Religion with ID ${dto.religionId} not found`,
        );
    }
    if (dto.casteId) {
      const exists = await this.prisma.caste.findFirst({
        where: { id: dto.casteId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(`Caste with ID ${dto.casteId} not found`);
    }
    if (dto.categoryId) {
      const exists = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Category with ID ${dto.categoryId} not found`,
        );
    }
    if (dto.motherTongueId) {
      const exists = await this.prisma.language.findFirst({
        where: { id: dto.motherTongueId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Mother Tongue Language with ID ${dto.motherTongueId} not found`,
        );
    }
    if (dto.bloodGroupId) {
      const exists = await this.prisma.bloodGroup.findFirst({
        where: { id: dto.bloodGroupId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Blood Group with ID ${dto.bloodGroupId} not found`,
        );
    }
    if (dto.disabilityTypeId) {
      const exists = await this.prisma.disability.findFirst({
        where: { id: dto.disabilityTypeId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Disability Type with ID ${dto.disabilityTypeId} not found`,
        );
    }
    if (dto.admissionSourceId) {
      const exists = await this.prisma.admissionSource.findFirst({
        where: { id: dto.admissionSourceId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(
          `Admission Source with ID ${dto.admissionSourceId} not found`,
        );
    }
    if (dto.quotaId) {
      const exists = await this.prisma.quota.findFirst({
        where: { id: dto.quotaId, deletedAt: null },
      });
      if (!exists)
        throw new NotFoundException(`Quota with ID ${dto.quotaId} not found`);
    }

    // 2. Perform duplicate check (returns warnings)
    const duplicateReport = await this.checkDuplicates(
      {
        aadhaarNo: dto.aadhaarNo,
        primaryMobile: dto.primaryMobile,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: dto.dob,
      },
      branchId,
    );

    // 3. Generate Form & Application numbers atomically
    await this.ensureNumberConfig(branchId, orgId, 'ADMISSION_FORM');
    await this.ensureNumberConfig(branchId, orgId, 'APPLICATION');

    const formNo = await this.numberingService.generateNextNumber(
      branchId,
      academicYearId,
      'ADMISSION_FORM',
    );
    const appNo = await this.numberingService.generateNextNumber(
      branchId,
      academicYearId,
      'APPLICATION',
    );

    const displayName = this.getDisplayName(
      dto.firstName,
      dto.middleName,
      dto.lastName,
    );

    // 4. Save applicant
    const applicant = await this.prisma.applicant.create({
      data: {
        ...dto,
        dob: dobDate,
        displayName,
        admissionFormNo: formNo,
        applicationNo: appNo,
        organizationId: orgId,
        branchId,
        academicYearId,
        createdBy: userId,
        admissionStatus: 'DRAFT',
      },
    });

    return {
      applicant,
      warnings: duplicateReport.hasDuplicates ? duplicateReport.matches : [],
    };
  }

  async findOne(id: string) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id, deletedAt: null },
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
        guardians: {
          include: {
            guardian: true,
            relationType: true,
          },
        },
        enrollment: true,
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }
    return applicant;
  }

  async update(id: string, dto: UpdateApplicantDto, userId?: string) {
    const applicant = await this.findOne(id);

    // Enforce lock state
    if (
      ['APPROVED', 'REJECTED', 'CANCELLED'].includes(applicant.admissionStatus)
    ) {
      throw new ForbiddenException(
        `Cannot modify applicant in status ${applicant.admissionStatus}`,
      );
    }

    const updatedData: any = {
      ...dto,
      updatedBy: userId,
    };

    if (dto.dob) {
      updatedData.dob = new Date(dto.dob);
    }

    const firstName =
      dto.firstName !== undefined ? dto.firstName : applicant.firstName;
    const middleName =
      dto.middleName !== undefined
        ? dto.middleName
        : applicant.middleName || undefined;
    const lastName =
      dto.lastName !== undefined ? dto.lastName : applicant.lastName;

    if (
      dto.firstName !== undefined ||
      dto.middleName !== undefined ||
      dto.lastName !== undefined
    ) {
      updatedData.displayName = this.getDisplayName(
        firstName,
        middleName,
        lastName,
      );
    }

    return this.prisma.applicant.update({
      where: { id },
      data: updatedData,
    });
  }

  async findAll(
    query: QueryApplicantDto,
    branchId: string,
    academicYearId: string,
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const whereClause: any = {
      branchId,
      academicYearId,
      deletedAt: null,
    };

    if (query.status) {
      whereClause.admissionStatus = query.status;
    }

    if (query.search) {
      whereClause.OR = [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { primaryMobile: { contains: query.search } },
        { aadhaarNo: { contains: query.search } },
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
        include: {
          gender: true,
          admissionSource: true,
          quota: true,
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async remove(id: string, userId?: string) {
    const applicant = await this.findOne(id);
    if (
      ['APPROVED', 'REJECTED', 'CANCELLED'].includes(applicant.admissionStatus)
    ) {
      throw new ForbiddenException(
        `Cannot delete applicant in status ${applicant.admissionStatus}`,
      );
    }

    return this.prisma.applicant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });
  }
}
