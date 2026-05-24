import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ReligionService } from '@/modules/admissions/masters/religion/religion.service';
import { NumberingService } from '@/modules/admissions/numbering/numbering.service';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { GuardiansService } from '@/modules/admissions/guardians/guardians.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { EnrollmentService } from '@/modules/admissions/enrollment/enrollment.service';
import { WorkflowState } from '@/modules/admissions/workflow/dto/workflow.dto';

describe('Admissions Module Foundation - Unit Tests', () => {
  let religionService: ReligionService;
  let numberingService: NumberingService;
  let applicantService: ApplicantService;
  let guardiansService: GuardiansService;
  let workflowService: WorkflowService;
  let enrollmentService: EnrollmentService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    religion: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gender: {
      findFirst: jest.fn(),
    },
    caste: {
      findFirst: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    language: {
      findFirst: jest.fn(),
    },
    bloodGroup: {
      findFirst: jest.fn(),
    },
    disability: {
      findFirst: jest.fn(),
    },
    admissionSource: {
      findFirst: jest.fn(),
    },
    quota: {
      findFirst: jest.fn(),
    },
    numberSequenceConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    numberSequenceCounter: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
    academicYear: {
      findUnique: jest.fn(),
    },
    program: {
      findUnique: jest.fn(),
    },
    academicUnit: {
      findUnique: jest.fn(),
    },
    applicant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    guardian: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    relationType: {
      findFirst: jest.fn(),
    },
    applicantGuardianMapping: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    enrollment: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    workflowHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReligionService,
        NumberingService,
        ApplicantService,
        GuardiansService,
        WorkflowService,
        EnrollmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    religionService = module.get<ReligionService>(ReligionService);
    numberingService = module.get<NumberingService>(NumberingService);
    applicantService = module.get<ApplicantService>(ApplicantService);
    guardiansService = module.get<GuardiansService>(GuardiansService);
    workflowService = module.get<WorkflowService>(WorkflowService);
    enrollmentService = module.get<EnrollmentService>(EnrollmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Master Data uniqueness', () => {
    it('should throw BadRequestException if master code already exists in scope', async () => {
      mockPrisma.religion.findFirst.mockResolvedValueOnce({ id: 'existing' }); // code match
      await expect(
        religionService.create({ code: 'HIND', name: 'Hindu' }, 'org-1', 'branch-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if master name already exists in scope', async () => {
      mockPrisma.religion.findFirst
        .mockResolvedValueOnce(null) // code ok
        .mockResolvedValueOnce({ id: 'existing' }); // name match
      await expect(
        religionService.create({ code: 'HIND', name: 'Hindu' }, 'org-1', 'branch-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Numbering Generation safety', () => {
    it('should generate next formatted string safely', async () => {
      mockPrisma.numberSequenceConfig.findUnique.mockResolvedValue({
        id: 'cfg-1',
        prefix: 'ADM',
        suffix: 'MUM',
        includeBranchCode: true,
        includeAcademicYear: true,
        sequencePadding: 4,
        format: '{prefix}-{branchCode}-{year}-{sequence}-{suffix}',
        resetStrategy: 'NEVER',
      });
      mockPrisma.numberSequenceCounter.findFirst.mockResolvedValue({ id: 'cnt-1', currentValue: 0 });
      mockPrisma.$queryRaw.mockResolvedValue([{ currentValue: 1 }]);
      mockPrisma.branch.findUnique.mockResolvedValue({ code: 'MUM' });
      mockPrisma.academicYear.findUnique.mockResolvedValue({ name: '2026' });

      const nextNum = await numberingService.generateNextNumber('branch-1', 'year-1', 'ADMISSION_FORM');
      expect(nextNum).toBe('ADM-MUM-2026-0001-MUM');
    });
  });

  describe('Applicant lifecycle and duplicate warning detection', () => {
    it('should warn duplicate matches on Aadhaar or mobile, but create applicant', async () => {
      mockPrisma.gender.findFirst.mockResolvedValue({ id: 'gen-1' });
      mockPrisma.numberSequenceConfig.findUnique.mockResolvedValue({ id: 'cfg-1', format: '{prefix}-{sequence}', sequencePadding: 4 });
      mockPrisma.numberSequenceCounter.findFirst.mockResolvedValue({ id: 'cnt-1' });
      mockPrisma.$queryRaw.mockResolvedValue([{ currentValue: 1 }]);
      mockPrisma.applicant.findMany.mockResolvedValue([
        { id: 'app-old', displayName: 'John Doe', primaryMobile: '9999999999', aadhaarNo: '111122223333' },
      ]);
      mockPrisma.applicant.create.mockResolvedValue({ id: 'app-new', displayName: 'John Doe' });

      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        dob: '2020-01-01',
        genderId: 'gen-1',
        primaryMobile: '9999999999',
        aadhaarNo: '111122223333',
        currentAddressLine1: 'Street 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      };

      const result = await applicantService.create(dto, 'org-1', 'branch-1', 'year-1');
      expect(result.warnings.length).toBe(1);
      expect(result.applicant.id).toBe('app-new');
    });
  });

  describe('Sibling guardian mappings emergency rules', () => {
    it('should reset other primary guardians to false if new isPrimary is mapped', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({ id: 'app-1', admissionStatus: 'DRAFT' });
      mockPrisma.guardian.findFirst.mockResolvedValue({ id: 'guard-1' });
      mockPrisma.relationType.findFirst.mockResolvedValue({ id: 'rel-1' });
      mockPrisma.applicantGuardianMapping.upsert.mockResolvedValue({ applicantId: 'app-1', guardianId: 'guard-1' });

      await guardiansService.mapGuardianToApplicant('app-1', {
        guardianId: 'guard-1',
        relationTypeId: 'rel-1',
        isPrimary: true,
      });

      expect(mockPrisma.applicantGuardianMapping.updateMany).toHaveBeenCalledWith({
        where: { applicantId: 'app-1', isPrimary: true },
        data: { isPrimary: false },
      });
    });
  });

  describe('Workflow Engine & illegal transitions', () => {
    it('should reject transitions not defined in valid transition matrix', async () => {
      mockPrisma.applicant.findUnique.mockResolvedValue({ id: 'app-1', admissionStatus: 'DRAFT' });

      await expect(
        workflowService.transitionState('app-1', { newStatus: WorkflowState.APPROVED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should permit valid transition draft -> submitted', async () => {
      mockPrisma.applicant.findUnique.mockResolvedValue({ id: 'app-1', admissionStatus: 'DRAFT' });
      mockPrisma.applicant.update.mockResolvedValue({ id: 'app-1', admissionStatus: 'SUBMITTED' });

      const updated = await workflowService.transitionState('app-1', { newStatus: WorkflowState.SUBMITTED });
      expect(updated.admissionStatus).toBe('SUBMITTED');
    });
  });

  describe('Enrollment foundation placement rules', () => {
    it('should throw BadRequestException if applicant is not approved', async () => {
      mockPrisma.applicant.findUnique.mockResolvedValue({ id: 'app-1', admissionStatus: 'DRAFT' });
      await expect(
        enrollmentService.createEnrollment('app-1', { programId: 'prog-1', academicUnitId: 'unit-1' }, 'org-1', 'branch-1', 'year-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
