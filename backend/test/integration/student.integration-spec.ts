import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { StudentService } from '@/modules/identity/student/student.service';
import { PersonService } from '@/modules/identity/person/person.service';
import { NumberingService } from '@/infrastructure/numbering/numbering.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { ResourceScope } from '@/common/scope/resource-scope';
import { CreateStudentInput } from '@/modules/identity/student/student.types';

/**
 * The Phase 2 exit condition: a permanent learner identity that cannot be
 * duplicated, cannot leak across a tenant or a branch, and whose code never
 * changes.
 *
 * Concurrency runs real parallel connections against real Postgres — mocked, it
 * would prove only that the code reads well.
 */
describe('Student identity (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let students: StudentService;
  let persons: PersonService;
  let numbering: NumberingService;

  const suffix = Date.now().toString();

  let orgA: string;
  let orgB: string;
  let branchMumbai: string;
  let branchPune: string;
  let branchB: string;
  let genderA: string;
  let genderB: string;

  let scopeMumbai: ResourceScope;
  let scopePune: ResourceScope;
  let scopeB: ResourceScope;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    students = moduleRef.get(StudentService);
    persons = moduleRef.get(PersonService);
    numbering = moduleRef.get(NumberingService);

    const makeOrg = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Student Test ${label}`,
            code: `ST${label}_${suffix}`,
            contactEmail: 's@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 8.64e7),
          },
        })
      ).id;

    const makeBranch = async (organizationId: string, label: string) =>
      (
        await prisma.branch.create({
          data: {
            organizationId,
            name: `Branch ${label}`,
            code: `SB${label}_${suffix}`,
            institutionType: 'SCHOOL',
            contactEmail: 'b@test.local',
            contactPhone: '1234567890',
            addressLine1: 'Road 1',
            city: 'Mumbai',
            state: 'MH',
            country: 'IN',
            pincode: '400001',
          },
        })
      ).id;

    orgA = await makeOrg('A');
    orgB = await makeOrg('B');
    branchMumbai = await makeBranch(orgA, 'MUM');
    branchPune = await makeBranch(orgA, 'PUN');
    branchB = await makeBranch(orgB, 'BBR');

    genderA = (
      await prisma.gender.create({
        data: { organizationId: orgA, code: `G_${suffix}`, name: `Gender ${suffix}` },
      })
    ).id;
    genderB = (
      await prisma.gender.create({
        data: { organizationId: orgB, code: `GB_${suffix}`, name: `GenderB ${suffix}` },
      })
    ).id;

    // Every organization must be provisioned before a student can exist. There
    // is no auto-creation: a missing sequence is a provisioning failure, not
    // something to invent at runtime.
    for (const org of [orgA, orgB]) {
      await numbering.createConfig(
        {
          purpose: 'STUDENT_CODE',
          prefix: 'STU',
          sequencePadding: 10,
          format: '{prefix}{sequence}',
        },
        org,
        null,
      );
    }

    scopeMumbai = { organizationId: orgA, branchId: branchMumbai, academicYearId: null };
    scopePune = { organizationId: orgA, branchId: branchPune, academicYearId: null };
    scopeB = { organizationId: orgB, branchId: branchB, academicYearId: null };
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.student.deleteMany({ where: { organizationId: org } });
      await prisma.personSensitive.deleteMany({ where: { organizationId: org } });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.numberSequenceCounter.deleteMany({
        where: { config: { organizationId: org } },
      });
      await prisma.numberSequenceConfig.deleteMany({ where: { organizationId: org } });
      await prisma.gender.deleteMany({ where: { organizationId: org } });
      await prisma.branch.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  afterEach(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.student.deleteMany({ where: { organizationId: org } });
      await prisma.personSensitive.deleteMany({ where: { organizationId: org } });
      await prisma.person.deleteMany({ where: { organizationId: org } });
    }
  });

  /**
   * Drain and wait for the audit row.
   *
   * The relay also runs on a timer, and `drain()` returns immediately while a
   * pass is already in flight — so one explicit call can legitimately publish
   * nothing. Polling makes the test assert the outcome rather than the timing.
   */
  async function drainUntilAudited(aggregateId: string, eventName: string) {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await moduleRef.get(OutboxRelay).drain();
      const rows = await prisma.auditLog.findMany({ where: { aggregateId } });
      if (rows.some((r) => r.eventName === eventName)) return rows;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return prisma.auditLog.findMany({ where: { aggregateId } });
  }

  /** A fresh Person, so each case starts from a clean identity. */
  async function newPerson(organizationId: string, seed: string) {
    const { personId } = await persons.resolve(organizationId, {
      firstName: 'Riya',
      lastName: `Sharma${seed}`,
      dob: new Date('2015-04-12'),
      phone: `98765${seed.padStart(5, '0').slice(-5)}`,
    });
    return personId;
  }

  function studentInput(
    over: Partial<CreateStudentInput> & Pick<CreateStudentInput, 'organizationId' | 'branchId' | 'personId'>,
  ): CreateStudentInput {
    return {
      firstName: 'Riya',
      lastName: 'Sharma',
      dob: new Date('2015-04-12'),
      genderId: over.organizationId === orgB ? genderB : genderA,
      createdVia: 'MIGRATION',
      ...over,
    };
  }

  describe('student code', () => {
    it('renders from the organization configuration', async () => {
      const personId = await newPerson(orgA, '1');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      expect(student.studentCode).toBe('STU0000000001');
      expect(student.id).toMatch(/^[0-9a-f-]{36}$/);
      // UUID v7: the version nibble is 7.
      expect(student.id[14]).toBe('7');
    });

    it('is not recomputed when the numbering format later changes', async () => {
      const personId = await newPerson(orgA, '2');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
      const original = student.studentCode;

      const config = await prisma.numberSequenceConfig.findFirstOrThrow({
        where: { organizationId: orgA, purpose: 'STUDENT_CODE' },
      });
      // Bypass the immutability guard deliberately: the question here is not
      // whether the guard works but whether a stored code is derived. Even with
      // the configuration changed underneath it, it must not move.
      await prisma.numberSequenceConfig.update({
        where: { id: config.id },
        data: { prefix: 'STD', sequencePadding: 6 },
      });

      const reread = await prisma.student.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(reread.studentCode).toBe(original);

      await prisma.numberSequenceConfig.update({
        where: { id: config.id },
        data: { prefix: 'STU', sequencePadding: 10 },
      });
    });

    it('freezes the format once a code has been issued', async () => {
      const personId = await newPerson(orgA, '3');
      await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const config = await prisma.numberSequenceConfig.findFirstOrThrow({
        where: { organizationId: orgA, purpose: 'STUDENT_CODE' },
      });

      // Mixed-width codes break lexicographic ordering, printed layouts and
      // every downstream pattern match.
      await expect(
        numbering.updateConfig(config.id, { sequencePadding: 6 }, orgA),
      ).rejects.toMatchObject({ response: { error: 'SEQUENCE_WIDTH_IMMUTABLE' } });

      await expect(
        numbering.updateConfig(config.id, { prefix: 'STD' }, orgA),
      ).rejects.toMatchObject({ response: { error: 'SEQUENCE_WIDTH_IMMUTABLE' } });
    });

    it('refuses to mint a student for an unprovisioned organization', async () => {
      const bare = await prisma.organization.create({
        data: {
          name: 'Unprovisioned',
          code: `UNP_${suffix}`,
          contactEmail: 'u@test.local',
          contactPhone: '1',
          masterExpiryDate: new Date(Date.now() + 8.64e7),
        },
      });

      try {
        const personId = await newPerson(bare.id, '9');
        await expect(
          students.createControlled(
            studentInput({
              organizationId: bare.id,
              branchId: branchMumbai,
              personId,
              genderId: genderA,
            }),
          ),
        ).rejects.toMatchObject({
          response: { error: 'NUMBERING_NOT_PROVISIONED' },
        });
      } finally {
        await prisma.person.deleteMany({ where: { organizationId: bare.id } });
        await prisma.organization.delete({ where: { id: bare.id } });
      }
    });
  });

  describe('mandatory concurrency acceptance', () => {
    /** Test A — 50 concurrent allocations produce 50 distinct codes. */
    it('issues 50 distinct codes under concurrent creation', async () => {
      const personIds = await Promise.all(
        Array.from({ length: 50 }, (_, i) => newPerson(orgA, `c${i}`)),
      );

      const created = await Promise.all(
        personIds.map((personId) =>
          students.createControlled(
            studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
          ),
        ),
      );

      const codes = created.map((s) => s.studentCode);
      expect(new Set(codes).size).toBe(50);
      // Gaps are permitted and duplicates are not. MONOTONIC buys exactly that
      // trade, and paying for continuity here would serialise every admission.
      expect(codes.every((c) => /^STU\d{10}$/.test(c))).toBe(true);
    });

    /** Test B — the same Person cannot become two Students. */
    it('yields one student under 20 concurrent attempts on one person', async () => {
      const personId = await newPerson(orgA, 'same');

      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          students.createControlled(
            studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
          ),
        ),
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);

      const rows = await prisma.student.findMany({ where: { personId } });
      expect(rows).toHaveLength(1);

      // A controlled business conflict, never a raw Prisma violation.
      for (const r of rejected) {
        expect((r.reason as any)?.response?.error).toBe('STUDENT_ALREADY_EXISTS');
      }
    });

    /** Test C — one applicant cannot produce two students. */
    it('yields one student under 20 concurrent attempts on one applicant', async () => {
      const sourceApplicantId = `applicant-${suffix}`;

      const personIds = await Promise.all(
        Array.from({ length: 20 }, (_, i) => newPerson(orgA, `a${i}`)),
      );

      const outcomes = await Promise.allSettled(
        personIds.map((personId) =>
          students.createControlled(
            studentInput({
              organizationId: orgA,
              branchId: branchMumbai,
              personId,
              createdVia: 'ADMISSION',
              sourceApplicantId,
            }),
          ),
        ),
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(19);

      const rows = await prisma.student.findMany({ where: { sourceApplicantId } });
      expect(rows).toHaveLength(1);

      for (const r of rejected) {
        expect((r.reason as any)?.response?.error).toBe('APPLICANT_ALREADY_ADMITTED');
      }
    });

    /** Test D — two organizations are independent. */
    it('keeps two organizations independent under concurrency', async () => {
      const personA = await newPerson(orgA, 'x');
      const personB = await newPerson(orgB, 'x');

      const [a, b] = await Promise.all([
        students.createControlled(
          studentInput({ organizationId: orgA, branchId: branchMumbai, personId: personA }),
        ),
        students.createControlled(
          studentInput({ organizationId: orgB, branchId: branchB, personId: personB }),
        ),
      ]);

      expect(a.id).not.toBe(b.id);
      expect(a.organizationId).toBe(orgA);
      expect(b.organizationId).toBe(orgB);

      // Each organization runs its own counter. Their positions are unrelated —
      // and deliberately not asserted as equal, because a NEVER-reset sequence
      // keeps advancing across everything that came before, which is exactly
      // the property that makes a code permanent.
      const [aSeq, bSeq] = [a, b].map((s) => Number(s.studentCode.slice(3)));
      expect(a.studentCode).toMatch(/^STU\d{10}$/);
      expect(b.studentCode).toMatch(/^STU\d{10}$/);
      expect(aSeq).toBeGreaterThan(0);
      expect(bSeq).toBeGreaterThan(0);

      const counters = await prisma.numberSequenceCounter.findMany({
        where: {
          config: { purpose: 'STUDENT_CODE', organizationId: { in: [orgA, orgB] } },
        },
      });
      expect(counters).toHaveLength(2);
    });
  });

  describe('tenant and branch isolation', () => {
    it('hides another organization student from a read', async () => {
      const personId = await newPerson(orgA, 'iso1');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      await expect(students.findById(student.id, scopeB)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        students.findById(student.id, scopeMumbai),
      ).resolves.toMatchObject({ id: student.id });
    });

    it('hides another branch student rather than refusing', async () => {
      const personId = await newPerson(orgA, 'iso2');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      // 404, not 403: a refusal would confirm the id exists to a caller who is
      // not entitled to know.
      await expect(students.findById(student.id, scopePune)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns an empty search rather than an error across branches', async () => {
      const personId = await newPerson(orgA, 'iso3');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const fromPune = await students.search(
        { q: student.studentCode },
        scopePune,
      );
      expect(fromPune.items).toHaveLength(0);

      const fromMumbai = await students.search(
        { q: student.studentCode },
        scopeMumbai,
      );
      expect(fromMumbai.items).toHaveLength(1);
    });

    it('widens to the organization only when asked', async () => {
      const personId = await newPerson(orgA, 'iso4');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const widened = await students.search(
        { q: student.studentCode, organizationWide: true },
        scopePune,
      );
      expect(widened.items.map((s) => s.id)).toContain(student.id);
    });

    it('never widens past the organization', async () => {
      const personId = await newPerson(orgA, 'iso5');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const fromOtherOrg = await students.search(
        { q: student.studentCode, organizationWide: true },
        scopeB,
      );
      expect(fromOtherOrg.items).toHaveLength(0);
    });

    it('scopes a code lookup', async () => {
      const personId = await newPerson(orgA, 'iso6');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      await expect(
        students.findByCode(student.studentCode, scopeB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    let studentId: string;
    let code: string;

    beforeEach(async () => {
      const personId = await newPerson(orgA, 's1');
      const created = await students.createControlled(
        studentInput({
          organizationId: orgA,
          branchId: branchMumbai,
          personId,
          firstName: 'Aarav',
          middleName: 'Kumar',
          lastName: 'Deshpande',
          primaryMobile: '+91 98765 43210',
        }),
      );
      studentId = created.id;
      code = created.studentCode;
    });

    it('finds by exact code', async () => {
      const result = await students.search({ q: code }, scopeMumbai);
      expect(result.items.map((s) => s.id)).toEqual([studentId]);
    });

    it('finds by lower-case code', async () => {
      const result = await students.search({ q: code.toLowerCase() }, scopeMumbai);
      expect(result.items.map((s) => s.id)).toEqual([studentId]);
    });

    it('finds by code prefix', async () => {
      const result = await students.search({ q: code.slice(0, 8) }, scopeMumbai);
      expect(result.items.map((s) => s.id)).toContain(studentId);
    });

    it('finds by name fragment, case-insensitively', async () => {
      const result = await students.search({ q: 'deshpande' }, scopeMumbai);
      expect(result.items.map((s) => s.id)).toContain(studentId);
    });

    it('finds by mobile in any of its written forms', async () => {
      for (const form of ['9876543210', '+91 98765 43210', '09876543210']) {
        const result = await students.search({ q: form }, scopeMumbai);
        expect(result.items.map((s) => s.id)).toContain(studentId);
      }
    });

    it('finds by exact date of birth', async () => {
      const result = await students.search(
        { dob: new Date('2015-04-12') },
        scopeMumbai,
      );
      expect(result.items.map((s) => s.id)).toContain(studentId);
    });

    it('returns each student once when several signals agree', async () => {
      const result = await students.search({ q: code }, scopeMumbai);
      expect(new Set(result.items.map((s) => s.id)).size).toBe(
        result.items.length,
      );
    });

    it('hides non-active students unless asked', async () => {
      await prisma.student.update({
        where: { id: studentId },
        data: { status: 'ARCHIVED' },
      });

      expect((await students.search({ q: code }, scopeMumbai)).items).toHaveLength(0);

      // Archival is a write lock, not a disappearance.
      const withInactive = await students.search(
        { q: code, includeInactive: true },
        scopeMumbai,
      );
      expect(withInactive.items.map((s) => s.id)).toContain(studentId);
    });

    it('paginates deterministically', async () => {
      const personIds = await Promise.all(
        Array.from({ length: 5 }, (_, i) => newPerson(orgA, `p${i}`)),
      );
      for (const personId of personIds) {
        await students.createControlled(
          studentInput({
            organizationId: orgA,
            branchId: branchMumbai,
            personId,
            firstName: 'Page',
            lastName: 'Test',
          }),
        );
      }

      const first = await students.search(
        { q: 'Page', page: 1, limit: 2 },
        scopeMumbai,
      );
      const second = await students.search(
        { q: 'Page', page: 2, limit: 2 },
        scopeMumbai,
      );

      expect(first.items).toHaveLength(2);
      expect(first.meta.total).toBe(5);
      // Equal-ranked rows must not reshuffle between pages.
      const overlap = first.items
        .map((s) => s.id)
        .filter((id) => second.items.some((x) => x.id === id));
      expect(overlap).toHaveLength(0);
    });

    it('caps the page size', async () => {
      const result = await students.search({ limit: 5000 }, scopeMumbai);
      expect(result.meta.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('demographic correction', () => {
    it('updates the current record and rebuilds the derived name', async () => {
      const personId = await newPerson(orgA, 'corr1');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const updated = await students.correctDemographics(
        student.id,
        { firstName: 'Riyaa' },
        scopeMumbai,
        'clerk-1',
      );

      expect(updated.firstName).toBe('Riyaa');
      expect(updated.displayName).toBe('Riyaa Sharma');
      // Identity is untouched by a demographic correction.
      expect(updated.studentCode).toBe(student.studentCode);
      expect(updated.personId).toBe(student.personId);
      expect(updated.organizationId).toBe(student.organizationId);
    });

    it('renormalises the mobile so search keeps working', async () => {
      const personId = await newPerson(orgA, 'corr2');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      await students.correctDemographics(
        student.id,
        { primaryMobile: '+91 91234 56789' },
        scopeMumbai,
      );

      const found = await students.search({ q: '9123456789' }, scopeMumbai);
      expect(found.items.map((s) => s.id)).toContain(student.id);
    });

    it('refuses a correction from another branch', async () => {
      const personId = await newPerson(orgA, 'corr3');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      await expect(
        students.correctDemographics(student.id, { firstName: 'Hijack' }, scopePune),
      ).rejects.toThrow(NotFoundException);

      const unchanged = await prisma.student.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(unchanged.firstName).not.toBe('Hijack');
    });

    it('refuses to correct an archived record', async () => {
      const personId = await newPerson(orgA, 'corr4');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
      await prisma.student.update({
        where: { id: student.id },
        data: { status: 'ARCHIVED' },
      });

      await expect(
        students.correctDemographics(student.id, { firstName: 'X' }, scopeMumbai),
      ).rejects.toMatchObject({ response: { error: 'STUDENT_ARCHIVED' } });
    });

    it('rejects an implausible date of birth', async () => {
      const personId = await newPerson(orgA, 'corr5');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      await expect(
        students.correctDemographics(
          student.id,
          { dob: new Date('2199-01-01') },
          scopeMumbai,
        ),
      ).rejects.toMatchObject({ response: { error: 'STUDENT_DOB_INVALID' } });
    });
  });

  describe('database invariants', () => {
    async function seedOne(seed: string) {
      const personId = await newPerson(orgA, seed);
      return students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
    }

    it('refuses a duplicate code within an organization', async () => {
      const student = await seedOne('inv1');
      const otherPerson = await newPerson(orgA, 'inv1b');

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,'ACTIVE','A','B','A B',
                   '2015-04-12',$5,false,'MIGRATION',now(),now())`,
          orgA,
          branchMumbai,
          otherPerson,
          student.studentCode,
          genderA,
        ),
      ).rejects.toThrow();
    });

    it('refuses two students for one person', async () => {
      const student = await seedOne('inv2');

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'STU9999999999','ACTIVE','A','B','A B',
                   '2015-04-12',$4,false,'MIGRATION',now(),now())`,
          orgA,
          branchMumbai,
          student.personId,
          genderA,
        ),
      ).rejects.toThrow();
    });

    it('refuses two students for one applicant', async () => {
      const personId = await newPerson(orgA, 'inv3');
      const applicantId = `app-inv3-${suffix}`;
      await students.createControlled(
        studentInput({
          organizationId: orgA,
          branchId: branchMumbai,
          personId,
          createdVia: 'ADMISSION',
          sourceApplicantId: applicantId,
        }),
      );

      const other = await newPerson(orgA, 'inv3b');
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","sourceApplicantId","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'STU9999999998','ACTIVE','A','B','A B',
                   '2015-04-12',$4,false,'ADMISSION',$5,now(),now())`,
          orgA,
          branchMumbai,
          other,
          genderA,
          applicantId,
        ),
      ).rejects.toThrow();
    });

    it('permits many students with no applicant behind them', async () => {
      // NULLs are distinct in a partial unique index, which is what lets a
      // migration import a whole school at once.
      await seedOne('inv4a');
      await seedOne('inv4b');
      const rows = await prisma.student.count({ where: { organizationId: orgA } });
      expect(rows).toBe(2);
    });

    it('refuses an ADMISSION student with no application behind it', async () => {
      const personId = await newPerson(orgA, 'inv5');
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'STU9999999997','ACTIVE','A','B','A B',
                   '2015-04-12',$4,false,'ADMISSION',now(),now())`,
          orgA,
          branchMumbai,
          personId,
          genderA,
        ),
      ).rejects.toThrow();
    });

    it('refuses a blank code', async () => {
      const personId = await newPerson(orgA, 'inv6');
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'   ','ACTIVE','A','B','A B',
                   '2015-04-12',$4,false,'MIGRATION',now(),now())`,
          orgA,
          branchMumbai,
          personId,
          genderA,
        ),
      ).rejects.toThrow();
    });

    it('refuses an implausible date of birth', async () => {
      const personId = await newPerson(orgA, 'inv7');
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Student"
             ("id","organizationId","branchId","personId","studentCode","status",
              "firstName","lastName","displayName","dob","genderId","disabilityStatus",
              "createdVia","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,'STU9999999996','ACTIVE','A','B','A B',
                   '2199-01-01',$4,false,'MIGRATION',now(),now())`,
          orgA,
          branchMumbai,
          personId,
          genderA,
        ),
      ).rejects.toThrow();
    });
  });

  describe('events and audit', () => {
    it('outboxes creation rather than publishing and hoping', async () => {
      const personId = await newPerson(orgA, 'ev1');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: student.id },
      });
      const names = events.map((e) => e.eventName);
      expect(names).toContain('student.created');
      expect(names).toContain('student.code_assigned');
    });

    it('carries no sensitive identity into an event', async () => {
      const personId = await newPerson(orgA, 'ev2');
      await persons.attachGovernmentId(orgA, personId, 'AADHAAR', '987654321012');

      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: student.id },
      });
      const person = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });

      const serialised = JSON.stringify(events);
      expect(serialised).not.toContain('987654321012');
      expect(serialised).not.toContain(person.govtIdHash!);
    });

    it('reaches the audit log with a field-level diff', async () => {
      const personId = await newPerson(orgA, 'ev3');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
      await students.correctDemographics(
        student.id,
        { firstName: 'Renamed' },
        scopeMumbai,
        'clerk-9',
      );

      const rows = await drainUntilAudited(student.id, 'student.updated');
      expect(rows.length).toBeGreaterThan(0);

      const updated = rows.find((r) => r.eventName === 'student.updated');
      expect(updated).toBeDefined();
      // "The record changed" is not an audit trail when the question is who
      // changed a name and from what.
      expect(JSON.stringify(updated!.changes)).toContain('firstName');
    });
  });

  describe('the identity boundary', () => {
    it('exposes no government identifier on the student record', async () => {
      const personId = await newPerson(orgA, 'b1');
      await persons.attachGovernmentId(orgA, personId, 'AADHAAR', '912345678901');

      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
      const row = await prisma.student.findUniqueOrThrow({
        where: { id: student.id },
      });

      expect(JSON.stringify(row)).not.toContain('912345678901');
      expect(Object.keys(row)).not.toContain('aadhaarNo');
      expect(Object.keys(row)).not.toContain('govtIdHash');
    });

    it('holds no placement, no account and no current-enrollment pointer', async () => {
      const personId = await newPerson(orgA, 'b2');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );
      const columns = Object.keys(
        await prisma.student.findUniqueOrThrow({ where: { id: student.id } }),
      );

      for (const forbidden of [
        'academicYearId',
        'programId',
        'academicUnitId',
        'rollNumber',
        'currentEnrollmentId',
        'admissionNo',
        'userId',
        'feeBalance',
        'attendancePercentage',
      ]) {
        expect(columns).not.toContain(forbidden);
      }
    });

    it('survives the branch pointer moving, code unchanged', async () => {
      const personId = await newPerson(orgA, 'b3');
      const student = await students.createControlled(
        studentInput({ organizationId: orgA, branchId: branchMumbai, personId }),
      );

      // Phase 6 owns the transfer operation; this only asserts the model does
      // not stand in its way.
      await prisma.student.update({
        where: { id: student.id },
        data: { branchId: branchPune },
      });

      const moved = await prisma.student.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(moved.branchId).toBe(branchPune);
      expect(moved.studentCode).toBe(student.studentCode);
      expect(moved.id).toBe(student.id);
      expect(moved.personId).toBe(student.personId);
    });
  });
});
