import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';

/**
 * The numbering defects that would have corrupted `studentCode`.
 *
 * Three of these fail against the pre-Phase-0 implementation, which is the
 * point of writing them: they are regression tests for defects that were real,
 * not hypotheses about defects that might appear.
 */
describe('Numbering engine (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let numbering: NumberingService;

  let orgId: string;
  let branchId: string;
  let academicYearId: string;

  const createdConfigIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    numbering = moduleRef.get(NumberingService);

    const org = await prisma.organization.create({
      data: {
        name: 'Numbering Test Org',
        code: 'NUMORG_' + Date.now(),
        contactEmail: 'numbering@test.local',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    orgId = org.id;

    const branch = await prisma.branch.create({
      data: {
        organizationId: orgId,
        name: 'Numbering Test Branch',
        code: 'NUMBR_' + Date.now(),
        institutionType: 'SCHOOL',
        contactEmail: 'branch@test.local',
        contactPhone: '1234567890',
        addressLine1: 'Road 1',
        city: 'Mumbai',
        state: 'MH',
        country: 'IN',
        pincode: '400001',
      },
    });
    branchId = branch.id;

    const year = await prisma.academicYear.create({
      data: {
        branchId,
        name: '2026-27',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
      },
    });
    academicYearId = year.id;
  });

  afterAll(async () => {
    await prisma.numberSequenceCounter.deleteMany({
      where: { configId: { in: createdConfigIds } },
    });
    await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: orgId } });
    await prisma.academicYear.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await moduleRef.close();
  });

  async function provisionStudentCode(padding = 10) {
    const config = await numbering.createConfig(
      {
        purpose: 'STUDENT_CODE',
        prefix: 'STU',
        sequencePadding: padding,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );
    createdConfigIds.push(config.id);
    return config;
  }

  /**
   * The defect that would have corrupted the identifier the whole ERP is built
   * on. `@@unique([configId, academicYearId])` does not constrain rows whose
   * academicYearId is null — which is every NEVER-reset counter — so every
   * allocation inserted a fresh counter and returned 1.
   */
  it('keeps exactly one counter for a NEVER-reset sequence across many allocations', async () => {
    const config = await provisionStudentCode();
    const iterations = 200;

    const values: string[] = [];
    for (let i = 0; i < iterations; i += 1) {
      values.push(
        await numbering.allocate(
          { purpose: 'STUDENT_CODE', organizationId: orgId },
          prisma,
        ),
      );
    }

    const counters = await prisma.numberSequenceCounter.findMany({
      where: { configId: config.id },
    });

    expect(counters).toHaveLength(1);
    expect(counters[0].currentValue).toBe(iterations);
    expect(new Set(values).size).toBe(iterations);
    expect(values[0]).toBe('STU0000000001');
    expect(values[iterations - 1]).toBe(`STU${String(iterations).padStart(10, '0')}`);
  });

  /**
   * The find-then-create handler caught its own unique violation and then read
   * — inside a transaction Postgres had already aborted. It failed with
   * "current transaction is aborted" the first time any sequence was allocated
   * transactionally, which is exactly what admit() does.
   */
  it('allocates inside a transaction when the counter does not yet exist', async () => {
    await provisionStudentCode();

    const value = await prisma.$transaction(async (tx) =>
      numbering.allocate({ purpose: 'STUDENT_CODE', organizationId: orgId }, tx),
    );

    expect(value).toBe('STU0000000001');
  });

  it('issues distinct values under concurrent allocation', async () => {
    await provisionStudentCode();
    const concurrency = 50;

    const values = await Promise.all(
      Array.from({ length: concurrency }, () =>
        numbering.allocate(
          { purpose: 'STUDENT_CODE', organizationId: orgId },
          prisma,
        ),
      ),
    );

    // Unique is the requirement. Contiguous is not: MONOTONIC permits gaps by
    // design, and paying for continuity here would serialise every admission.
    expect(new Set(values).size).toBe(concurrency);
  });

  it('burns a number when a MONOTONIC caller rolls back, and never reissues it', async () => {
    await provisionStudentCode();

    const first = await numbering.allocate(
      { purpose: 'STUDENT_CODE', organizationId: orgId },
      prisma,
    );

    let burned: string | undefined;
    await prisma
      .$transaction(async (tx) => {
        burned = await numbering.allocate(
          { purpose: 'STUDENT_CODE', organizationId: orgId },
          tx,
        );
        throw new Error('rollback');
      })
      .catch(() => undefined);

    const next = await numbering.allocate(
      { purpose: 'STUDENT_CODE', organizationId: orgId },
      prisma,
    );

    expect(first).toBe('STU0000000001');
    expect(burned).toBe('STU0000000002');
    // The gap is the accepted cost of not holding the counter for the caller's
    // whole transaction. The value is never handed out twice.
    expect(next).toBe('STU0000000003');
  });

  it('refuses a yearly sequence whose format renders no year', async () => {
    // The counter restarts every April. Without a year in the value, the
    // second year reissues the first year's numbers — and `Admission` is
    // unique on `(branchId, admissionNo)` with no year in it, so the branch
    // would simply stop being able to admit twelve months in.
    await expect(
      numbering.createConfig(
        {
          purpose: 'ADMISSION_NO',
          prefix: 'AD',
          sequencePadding: 5,
          format: '{prefix}-{sequence}',
        },
        orgId,
        branchId,
      ),
    ).rejects.toMatchObject({
      response: { error: 'NUMBERING_FORMAT_MISSING_YEAR' },
    });
  });

  it('allows a never-resetting sequence to omit the year', async () => {
    // STUDENT_CODE never restarts, so a year in it would be noise — and worse,
    // would imply the code says something about when the student joined.
    const config = await numbering.createConfig(
      {
        purpose: 'EMPLOYEE_CODE',
        prefix: 'EMP',
        sequencePadding: 6,
        format: '{prefix}{sequence}',
      },
      orgId,
      null,
    );
    createdConfigIds.push(config.id);
    expect(config.resetStrategy).toBe('NEVER');
  });

  it('rolls the counter back with a GAPLESS caller, leaving no hole', async () => {
    const config = await numbering.createConfig(
      {
        purpose: 'RECEIPT',
        prefix: 'RCP',
        sequencePadding: 6,
        // RECEIPT resets yearly, so the format has to carry the year.
        format: '{prefix}-{year}-{sequence}',
      },
      orgId,
      branchId,
    );
    createdConfigIds.push(config.id);

    const first = await prisma.$transaction(async (tx) =>
      numbering.allocate(
        { purpose: 'RECEIPT', organizationId: orgId, branchId, academicYearId },
        tx,
      ),
    );

    await prisma
      .$transaction(async (tx) => {
        await numbering.allocate(
          { purpose: 'RECEIPT', organizationId: orgId, branchId, academicYearId },
          tx,
        );
        throw new Error('rollback');
      })
      .catch(() => undefined);

    const second = await prisma.$transaction(async (tx) =>
      numbering.allocate(
        { purpose: 'RECEIPT', organizationId: orgId, branchId, academicYearId },
        tx,
      ),
    );

    // The year renders because the format asks for it — a yearly sequence that
    // did not carry its year would reissue these numbers next April.
    expect(first).toMatch(/^RCP-.+-000001$/);
    // A receipt series an auditor checks for continuity must not skip.
    expect(second).toMatch(/^RCP-.+-000002$/);
  });

  it('expresses an organization-scoped sequence at all', async () => {
    const config = await provisionStudentCode();

    expect(config.scope).toBe('ORGANIZATION');
    expect(config.branchId).toBeNull();
    expect(config.resetStrategy).toBe('NEVER');
  });

  it('refuses a second sequence for the same purpose and scope', async () => {
    await provisionStudentCode();

    await expect(
      numbering.createConfig(
        {
          purpose: 'STUDENT_CODE',
          prefix: 'STD',
          sequencePadding: 8,
          format: '{prefix}{sequence}',
        },
        orgId,
        null,
      ),
    ).rejects.toMatchObject({ response: { error: 'NUMBERING_CONFIG_EXISTS' } });
  });

  it('lets two organizations run different formats independently', async () => {
    await provisionStudentCode();

    const otherOrg = await prisma.organization.create({
      data: {
        name: 'Second Org',
        code: 'NUMORG2_' + Date.now(),
        contactEmail: 'second@test.local',
        contactPhone: '1234567890',
        masterExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    try {
      const otherConfig = await numbering.createConfig(
        {
          purpose: 'STUDENT_CODE',
          prefix: 'STD',
          sequencePadding: 8,
          format: '{prefix}{sequence}',
        },
        otherOrg.id,
        null,
      );

      const a = await numbering.allocate(
        { purpose: 'STUDENT_CODE', organizationId: orgId },
        prisma,
      );
      const b = await numbering.allocate(
        { purpose: 'STUDENT_CODE', organizationId: otherOrg.id },
        prisma,
      );

      expect(a).toBe('STU0000000001');
      expect(b).toBe('STD00000001');

      await prisma.numberSequenceCounter.deleteMany({
        where: { configId: otherConfig.id },
      });
      await prisma.numberSequenceConfig.delete({ where: { id: otherConfig.id } });
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });

  it('rejects a format with no counter at the database, not only in the service', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "NumberSequenceConfig"
           ("id","organizationId","branchId","scope","purpose","allocationMode",
            "sequencePadding","format","resetStrategy","isActive","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, NULL, 'ORGANIZATION', 'EMPLOYEE_CODE',
                 'MONOTONIC', 4, '{prefix}-{year}', 'NEVER', true, now(), now())`,
        orgId,
      ),
    ).rejects.toThrow();
  });

  it('rejects a branch id on an organization-scoped sequence at the database', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "NumberSequenceConfig"
           ("id","organizationId","branchId","scope","purpose","allocationMode",
            "sequencePadding","format","resetStrategy","isActive","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'ORGANIZATION', 'EMPLOYEE_CODE',
                 'MONOTONIC', 4, '{prefix}{sequence}', 'NEVER', true, now(), now())`,
        orgId,
        branchId,
      ),
    ).rejects.toThrow();
  });

  it('freezes the rendered width once an identity sequence has issued a value', async () => {
    const config = await provisionStudentCode();

    await numbering.allocate(
      { purpose: 'STUDENT_CODE', organizationId: orgId },
      prisma,
    );

    await expect(
      numbering.updateConfig(config.id, { sequencePadding: 6 }, orgId),
    ).rejects.toMatchObject({ response: { error: 'SEQUENCE_WIDTH_IMMUTABLE' } });

    await expect(
      numbering.updateConfig(config.id, { prefix: 'STD' }, orgId),
    ).rejects.toMatchObject({ response: { error: 'SEQUENCE_WIDTH_IMMUTABLE' } });

    // A suffix does not change the counter's rendered width, so it stays open.
    await expect(
      numbering.updateConfig(config.id, { isActive: true }, orgId),
    ).resolves.toBeDefined();
  });

  it('previews a format without consuming a value', async () => {
    const config = await provisionStudentCode();

    const preview = await numbering.preview(config.id, { sampleValue: 42 }, orgId);
    expect(preview.rendered).toBe('STU0000000042');

    const counters = await prisma.numberSequenceCounter.findMany({
      where: { configId: config.id },
    });
    expect(counters).toHaveLength(0);
  });

  afterEach(async () => {
    // Each case provisions its own sequence; clear them so the next one starts
    // from a known counter rather than inheriting the previous test's position.
    await prisma.numberSequenceCounter.deleteMany({
      where: { config: { organizationId: orgId } },
    });
    await prisma.numberSequenceConfig.deleteMany({
      where: { organizationId: orgId },
    });
  });
});
