import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { PersonService } from '@/modules/identity/person/person.service';
import { IdentityHashService } from '@/infrastructure/crypto/identity-hash.service';
import { IdentityCryptoService } from '@/infrastructure/crypto/identity-crypto.service';
import { GovernmentIdType } from '@/generated/client';

/**
 * The Phase 1 exit condition, plus the isolation guarantees around it.
 *
 * The concurrency cases run real parallel connections against real Postgres.
 * Mocked, they would prove only that the code reads well.
 */
describe('Person identity foundation (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let persons: PersonService;
  let hashes: IdentityHashService;
  let crypto: IdentityCryptoService;

  let orgA: string;
  let orgB: string;

  const suffix = Date.now().toString();
  const AADHAAR = '987654321012';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    persons = moduleRef.get(PersonService);
    hashes = moduleRef.get(IdentityHashService);
    crypto = moduleRef.get(IdentityCryptoService);

    const make = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Person Test ${label}`,
            code: `PT${label}_${suffix}`,
            contactEmail: 'p@test.local',
            contactPhone: '1234567890',
            masterExpiryDate: new Date(Date.now() + 8.64e7),
          },
        })
      ).id;

    orgA = await make('A');
    orgB = await make('B');
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.outboxEvent.deleteMany({ where: { organizationId: org } });
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.personMatchDecision.deleteMany({
        where: { organizationId: org },
      });
      await prisma.personSensitive.deleteMany({
        where: { organizationId: org },
      });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.organizationDataKey.deleteMany({
        where: { organizationId: org },
      });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  afterEach(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.personMatchDecision.deleteMany({
        where: { organizationId: org },
      });
      await prisma.personSensitive.deleteMany({
        where: { organizationId: org },
      });
      await prisma.person.deleteMany({ where: { organizationId: org } });
    }
  });

  const identity = (over: Record<string, unknown> = {}) => ({
    firstName: 'Riya',
    lastName: 'Sharma',
    dob: new Date('2015-04-12'),
    phone: '9876543210',
    governmentIdType: GovernmentIdType.AADHAAR,
    governmentId: AADHAAR,
    ...over,
  });

  describe('the exit condition', () => {
    /**
     * The race the naive implementation loses. Twenty callers all read "no such
     * person" and all insert; the database is what decides, and the losers
     * adopt the winner's row instead of surfacing a constraint error.
     */
    it('produces exactly one Person under 20 concurrent resolves', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => persons.resolve(orgA, identity())),
      );

      const ids = new Set(results.map((r) => r.personId));
      expect(ids.size).toBe(1);

      const rows = await prisma.person.findMany({
        where: { organizationId: orgA },
      });
      expect(rows).toHaveLength(1);

      // Exactly one caller created it; the rest matched deterministically.
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(results.filter((r) => r.matchedByGovernmentId)).toHaveLength(19);
    });

    it('never surfaces a raw unique violation to the caller', async () => {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, () => persons.resolve(orgA, identity())),
      );

      expect(outcomes.every((o) => o.status === 'fulfilled')).toBe(true);
    });

    it('gives the same identifier in two organizations two independent Persons', async () => {
      const a = await persons.resolve(orgA, identity());
      const b = await persons.resolve(orgB, identity());

      expect(a.personId).not.toBe(b.personId);

      const rowA = await prisma.person.findUniqueOrThrow({
        where: { id: a.personId },
      });
      const rowB = await prisma.person.findUniqueOrThrow({
        where: { id: b.personId },
      });

      expect(rowA.organizationId).toBe(orgA);
      expect(rowB.organizationId).toBe(orgB);

      // The organization is inside the HMAC message, so even someone holding
      // both rows cannot tell they describe the same human.
      expect(rowA.govtIdHash).not.toBe(rowB.govtIdHash);
    });

    it('holds under concurrency in both organizations at once', async () => {
      await Promise.all([
        ...Array.from({ length: 20 }, () => persons.resolve(orgA, identity())),
        ...Array.from({ length: 20 }, () => persons.resolve(orgB, identity())),
      ]);

      expect(
        await prisma.person.count({ where: { organizationId: orgA } }),
      ).toBe(1);
      expect(
        await prisma.person.count({ where: { organizationId: orgB } }),
      ).toBe(1);
    });
  });

  describe('tenant isolation', () => {
    it('hides another organization identity from a read', async () => {
      const a = await persons.resolve(orgA, identity());

      await expect(persons.findOne(orgB, a.personId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(persons.findOne(orgA, a.personId)).resolves.toMatchObject({
        id: a.personId,
      });
    });

    it('does not surface another organization identity as a candidate', async () => {
      await persons.resolve(orgA, identity());

      const candidates = await persons.findCandidates(orgB, {
        firstName: 'Riya',
        lastName: 'Sharma',
        dob: new Date('2015-04-12'),
        phone: '9876543210',
      });

      expect(candidates).toHaveLength(0);
    });

    it('refuses to attach an identifier to another organization identity', async () => {
      const a = await persons.resolve(orgA, identity({ governmentId: null }));

      await expect(
        persons.attachGovernmentId(
          orgB,
          a.personId,
          GovernmentIdType.AADHAAR,
          AADHAAR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lets each organization hold its own encryption key', async () => {
      await persons.resolve(orgA, identity());
      await persons.resolve(orgB, identity());

      const keys = await prisma.organizationDataKey.findMany({
        where: { organizationId: { in: [orgA, orgB] } },
      });
      expect(keys).toHaveLength(2);
      // One tenant's key never opens another's ciphertext.
      expect(
        Buffer.from(keys[0].dekWrappedOperational).equals(
          Buffer.from(keys[1].dekWrappedOperational),
        ),
      ).toBe(false);
    });
  });

  describe('sensitive data at rest', () => {
    it('stores ciphertext and a blind index, never the identifier', async () => {
      const { personId } = await persons.resolve(orgA, identity());

      const person = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });
      const sensitive = await prisma.personSensitive.findUniqueOrThrow({
        where: { personId },
      });

      const serialised = JSON.stringify({ person, sensitive });
      expect(serialised).not.toContain(AADHAAR);

      expect(person.govtIdHash).toMatch(/^[0-9a-f]{64}$/);
      expect(sensitive.aadhaarEnc).not.toBeNull();
      expect(sensitive.aadhaarLast4).toBe('1012');
      expect(Buffer.from(sensitive.aadhaarEnc!).toString('utf8')).not.toContain(
        AADHAAR,
      );
    });

    it('round-trips the value through the organization key', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      const sensitive = await prisma.personSensitive.findUniqueOrThrow({
        where: { personId },
      });

      const plaintext = await crypto.decrypt(
        orgA,
        Buffer.from(sensitive.aadhaarEnc!),
        sensitive.keyVersion,
      );
      expect(plaintext).toBe(AADHAAR);
    });

    it('refuses to open one organization ciphertext with another key', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      const sensitive = await prisma.personSensitive.findUniqueOrThrow({
        where: { personId },
      });

      // Provision B's key, then try to read A's value under it.
      await persons.resolve(orgB, identity({ governmentId: '912345678901' }));

      await expect(
        crypto.decrypt(
          orgB,
          Buffer.from(sensitive.aadhaarEnc!),
          sensitive.keyVersion,
        ),
      ).rejects.toMatchObject({
        response: { error: 'SENSITIVE_DECRYPT_FAILED' },
      });
    });

    it('leaves the identity standing after crypto-erasure', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      const before = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });

      await crypto.cryptoEraseSubject(personId, 'operator-1');

      const person = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });
      const sensitive = await prisma.personSensitive.findUniqueOrThrow({
        where: { personId },
      });

      // The recoverable value is gone; the identity and its academic future are
      // not, and the blind index survives so an erased subject cannot re-enrol
      // as a stranger and acquire a second identity.
      expect(sensitive.aadhaarEnc).toBeNull();
      expect(sensitive.aadhaarLast4).toBeNull();
      expect(sensitive.erasedAt).not.toBeNull();
      expect(person.govtIdHash).toBe(before.govtIdHash);

      const again = await persons.resolve(orgA, identity());
      expect(again.personId).toBe(personId);
      expect(again.created).toBe(false);
    });
  });

  describe('attaching an identifier', () => {
    it('binds a late-arriving identifier to an existing identity', async () => {
      const created = await persons.resolve(
        orgA,
        identity({ governmentId: null }),
      );
      expect(created.created).toBe(true);

      const result = await persons.attachGovernmentId(
        orgA,
        created.personId,
        GovernmentIdType.AADHAAR,
        AADHAAR,
      );

      expect(result.last4).toBe('1012');

      // The identity is now reachable deterministically.
      const resolved = await persons.resolve(orgA, identity());
      expect(resolved.personId).toBe(created.personId);
      expect(resolved.matchedByGovernmentId).toBe(true);
    });

    it('gives one owner under 20 concurrent attempts on two identities', async () => {
      const a = await persons.resolve(
        orgA,
        identity({
          firstName: 'Ravi',
          governmentId: null,
          phone: '9000000001',
        }),
      );
      const b = await persons.resolve(
        orgA,
        identity({
          firstName: 'Kiran',
          governmentId: null,
          phone: '9000000002',
        }),
      );

      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          persons.attachGovernmentId(
            orgA,
            i % 2 === 0 ? a.personId : b.personId,
            GovernmentIdType.AADHAAR,
            AADHAAR,
          ),
        ),
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      );

      // Exactly one identity ends up owning it. Repeat attempts by the winner
      // are idempotent, so the successful count may exceed one — what must not
      // happen is two identities holding the same index.
      const owners = await prisma.person.findMany({
        where: { organizationId: orgA, govtIdHash: { not: null } },
        select: { id: true },
      });
      expect(owners).toHaveLength(1);
      expect(fulfilled.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);

      // No raw Prisma violation, and no identifier in the message.
      for (const r of rejected) {
        const body = JSON.stringify((r.reason as any)?.response ?? r.reason);
        expect(body).not.toContain(AADHAAR);
        expect(body).toMatch(
          /GOVERNMENT_ID_ALREADY_ASSOCIATED|GOVERNMENT_ID_ALREADY_SET/,
        );
      }
    });

    it('rejects an invalid identifier before anything is stored', async () => {
      const created = await persons.resolve(
        orgA,
        identity({ governmentId: null }),
      );

      await expect(
        persons.attachGovernmentId(
          orgA,
          created.personId,
          GovernmentIdType.AADHAAR,
          '12345',
        ),
      ).rejects.toMatchObject({ response: { error: 'GOVERNMENT_ID_INVALID' } });

      const person = await prisma.person.findUniqueOrThrow({
        where: { id: created.personId },
      });
      expect(person.govtIdHash).toBeNull();
    });
  });

  describe('candidate matching', () => {
    it('returns a deterministic match silently rather than as a warning', async () => {
      await persons.resolve(orgA, identity());
      const second = await persons.resolve(orgA, identity());

      expect(second.matchedByGovernmentId).toBe(true);
      // A matching identifier is the same human, not something to review.
      expect(second.warnings).toHaveLength(0);
    });

    it('flags twins as a suggestion without blocking either', async () => {
      const first = await persons.resolve(
        orgA,
        identity({ firstName: 'Aarav', governmentId: null }),
      );
      const second = await persons.resolve(
        orgA,
        identity({ firstName: 'Advik', governmentId: null }),
      );

      // Both exist. Neither was blocked: twins share a birthday, a household
      // number and their parents, and refusing the second is refusing a valid
      // applicant.
      expect(first.personId).not.toBe(second.personId);
      expect(second.warnings.map((w) => w.personId)).toContain(first.personId);
      expect(second.warnings[0].confidence).toBe('MEDIUM');
      expect(second.warnings[0].matchedOn).toContain('phone+dob');
    });

    it('stops warning about a pair a human has judged distinct', async () => {
      const first = await persons.resolve(
        orgA,
        identity({ firstName: 'Aarav', governmentId: null }),
      );
      const second = await persons.resolve(
        orgA,
        identity({ firstName: 'Advik', governmentId: null }),
      );

      await persons.recordDistinct(
        orgA,
        first.personId,
        second.personId,
        'Twins, confirmed with the parent',
        'clerk-1',
      );

      const candidates = await persons.findCandidates(
        orgA,
        {
          firstName: 'Advik',
          lastName: 'Sharma',
          dob: new Date('2015-04-12'),
          phone: '9876543210',
        },
        second.personId,
      );

      expect(candidates.map((c) => c.personId)).not.toContain(first.personId);
    });

    it('requires a reason for a match decision', async () => {
      const a = await persons.resolve(orgA, identity({ governmentId: null }));
      const b = await persons.resolve(
        orgA,
        identity({ firstName: 'Other', governmentId: null }),
      );

      await expect(
        persons.recordDistinct(orgA, a.personId, b.personId, '   ', 'clerk-1'),
      ).rejects.toMatchObject({
        response: { error: 'MATCH_DECISION_REASON_REQUIRED' },
      });
    });
  });

  describe('database invariants', () => {
    it('refuses two identities with one identifier in one organization', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      const person = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });

      await expect(
        prisma.person.create({
          data: {
            organizationId: orgA,
            govtIdHash: person.govtIdHash,
            dob: new Date('2015-04-12'),
            nameNormalized: 'someone else',
          },
        }),
      ).rejects.toThrow();
    });

    it('permits any number of identities with no identifier', async () => {
      // Postgres treats NULLs as distinct, which is what lets a school admit
      // children before an Aadhaar exists.
      for (let i = 0; i < 3; i += 1) {
        await prisma.person.create({
          data: {
            organizationId: orgA,
            dob: new Date('2015-04-12'),
            nameNormalized: `child ${i}`,
          },
        });
      }
      expect(
        await prisma.person.count({ where: { organizationId: orgA } }),
      ).toBe(3);
    });

    it('rejects an implausible date of birth', async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Person" ("id","organizationId","dob","nameNormalized","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text, $1, '2199-01-01', 'future child', now(), now())`,
          orgA,
        ),
      ).rejects.toThrow();
    });

    it('rejects a blank matching key', async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Person" ("id","organizationId","dob","nameNormalized","createdAt","updatedAt")
           VALUES (gen_random_uuid()::text, $1, '2015-04-12', '   ', now(), now())`,
          orgA,
        ),
      ).rejects.toThrow();
    });

    it('rejects an identity merged into itself', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "Person" SET "mergedIntoPersonId" = "id" WHERE "id" = $1`,
          personId,
        ),
      ).rejects.toThrow();
    });

    it('rejects a match decision recorded out of canonical order', async () => {
      const a = await persons.resolve(orgA, identity({ governmentId: null }));
      const b = await persons.resolve(
        orgA,
        identity({ firstName: 'Other', governmentId: null }),
      );
      const [low, high] = [a.personId, b.personId].sort();

      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "PersonMatchDecision"
             ("id","organizationId","personAId","personBId","decision","reason","decidedBy","decidedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'DISTINCT', 'r', 'u', now())`,
          orgA,
          high,
          low,
        ),
      ).rejects.toThrow();
    });

    it('rejects an ACTIVE data key with only one wrap', async () => {
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "OrganizationDataKey"
             ("id","organizationId","dekWrappedOperational","operationalKekVersion","status","createdAt")
           VALUES (gen_random_uuid()::text, $1, '\\x00'::bytea, 1, 'ACTIVE', now())`,
          `probe-${suffix}`,
        ),
      ).rejects.toThrow();
    });
  });

  describe('event and audit payloads', () => {
    it('carries no identifier into the outbox', async () => {
      const { personId } = await persons.resolve(orgA, identity());

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: personId },
      });

      expect(events.length).toBeGreaterThan(0);
      const serialised = JSON.stringify(events);
      expect(serialised).not.toContain(AADHAAR);
      // Not even a derived form: the blind index is a stable per-tenant handle
      // for a value the consumer is not entitled to.
      const person = await prisma.person.findUniqueOrThrow({
        where: { id: personId },
      });
      expect(serialised).not.toContain(person.govtIdHash!);
    });

    it('carries no identifier into the audit log', async () => {
      const { personId } = await persons.resolve(orgA, identity());
      await moduleRef
        .get((await import('@/infrastructure/outbox/outbox.relay')).OutboxRelay)
        .drain();

      const rows = await prisma.auditLog.findMany({
        where: { aggregateId: personId },
      });

      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(AADHAAR);
    });
  });

  describe('configuration', () => {
    it('reports what is missing without revealing anything', () => {
      const readiness = crypto.describeReadiness();
      expect(typeof readiness.operationalKey).toBe('boolean');
      expect(typeof readiness.recoveryCustody).toBe('boolean');
      expect(JSON.stringify(readiness)).not.toMatch(/[A-Za-z0-9+/]{40,}/);
    });

    it('has a configured pepper in this environment', () => {
      expect(hashes.isConfigured()).toBe(true);
    });
  });
});
