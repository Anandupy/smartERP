import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { ReligionService } from '@/modules/admissions/masters/religion/religion.service';
import { NumberingService } from '@/modules/admissions/numbering/numbering.service';
import { ApplicantService } from '@/modules/admissions/applicant/applicant.service';
import { GuardiansService } from '@/modules/admissions/guardians/guardians.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { EnrollmentService } from '@/modules/admissions/enrollment/enrollment.service';
import { WorkflowState } from '@/modules/admissions/workflow/dto/workflow.dto';

describe('Admissions Module Integration', () => {
  let prisma: PrismaService;
  let religionService: ReligionService;
  let numberingService: NumberingService;
  let applicantService: ApplicantService;
  let guardiansService: GuardiansService;
  let workflowService: WorkflowService;
  let enrollmentService: EnrollmentService;

  let testBranchId: string;
  let testOrgId: string;
  let testYearId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    religionService = module.get<ReligionService>(ReligionService);
    numberingService = module.get<NumberingService>(NumberingService);
    applicantService = module.get<ApplicantService>(ApplicantService);
    guardiansService = module.get<GuardiansService>(GuardiansService);
    workflowService = module.get<WorkflowService>(WorkflowService);
    enrollmentService = module.get<EnrollmentService>(EnrollmentService);

    await prisma.onModuleInit();

    // Retrieve or seed a test organization, branch, and academic year to test relationships
    const org = await prisma.organization.findFirst();
    if (org) {
      testOrgId = org.id;
    } else {
      const newOrg = await prisma.organization.create({
        data: {
          name: 'Test Org',
          code: 'TORG_' + Date.now(),
          contactEmail: 'test@org.com',
          contactPhone: '1234567890',
          masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
      testOrgId = newOrg.id;
    }

    const branch = await prisma.branch.findFirst({ where: { organizationId: testOrgId } });
    if (branch) {
      testBranchId = branch.id;
    } else {
      const newBranch = await prisma.branch.create({
        data: {
          organizationId: testOrgId,
          name: 'Test Branch',
          code: 'TBR_' + Date.now(),
          institutionType: 'SCHOOL',
          contactEmail: 'test@branch.com',
          contactPhone: '1234567890',
          addressLine1: 'Road 1',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
        },
      });
      testBranchId = newBranch.id;
    }

    const year = await prisma.academicYear.findFirst({ where: { branchId: testBranchId } });
    if (year) {
      testYearId = year.id;
    } else {
      const newYear = await prisma.academicYear.create({
        data: {
          branchId: testBranchId,
          name: '2026-27',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          isActive: true,
        },
      });
      testYearId = newYear.id;
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  it('should verify transactional creation of master and applicant record', async () => {
    await prisma.$transaction(async (tx) => {
      // 1. Create a religion master
      const religion = await tx.religion.create({
        data: {
          organizationId: testOrgId,
          branchId: testBranchId,
          code: 'TEST_REL_' + Date.now(),
          name: 'Test Religion Name',
          displayOrder: 1,
        },
      });
      expect(religion.id).toBeDefined();

      // 2. Create a gender master
      const gender = await tx.gender.create({
        data: {
          organizationId: testOrgId,
          branchId: testBranchId,
          code: 'TEST_GEN_' + Date.now(),
          name: 'Test Gender Name',
          displayOrder: 1,
        },
      });

      // 3. Configure Number Sequence Configs for test
      const config1 = await tx.numberSequenceConfig.create({
        data: {
          organizationId: testOrgId,
          branchId: testBranchId,
          purpose: 'ADMISSION_FORM',
          prefix: 'ADM',
          format: '{prefix}-{year}-{sequence}',
          includeAcademicYear: true,
          resetStrategy: 'YEARLY',
        },
      });
      expect(config1.id).toBeDefined();

      const config2 = await tx.numberSequenceConfig.create({
        data: {
          organizationId: testOrgId,
          branchId: testBranchId,
          purpose: 'APPLICATION',
          prefix: 'APP',
          format: '{prefix}-{sequence}',
          sequencePadding: 3,
        },
      });

      // 4. Generate form/app numbers using NumberingService on transactional client
      const formNo = await numberingService.generateNextNumber(testBranchId, testYearId, 'ADMISSION_FORM', tx);
      const appNo = await numberingService.generateNextNumber(testBranchId, testYearId, 'APPLICATION', tx);
      expect(formNo).toContain('ADM-');
      expect(appNo).toContain('APP-001');

      // 5. Create applicant
      const applicant = await tx.applicant.create({
        data: {
          organizationId: testOrgId,
          branchId: testBranchId,
          academicYearId: testYearId,
          admissionFormNo: formNo,
          applicationNo: appNo,
          firstName: 'Integration',
          lastName: 'Test',
          displayName: 'Integration Test',
          dob: new Date('2020-01-01'),
          genderId: gender.id,
          religionId: religion.id,
          primaryMobile: '9988776655',
          currentAddressLine1: 'Mumbai Address',
          city: 'Mumbai',
          state: 'MH',
          country: 'IN',
          pincode: '400001',
          admissionStatus: 'DRAFT',
        },
      });
      expect(applicant.id).toBeDefined();

      // Force Rollback to keep integration db clean
      throw new Error('Rollback transaction');
    }).catch((err) => {
      expect(err.message).toBe('Rollback transaction');
    });
  });
});
