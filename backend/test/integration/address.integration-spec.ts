import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { AddressService } from '@/modules/identity/address/address.service';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { AddressType } from '@/generated/client';

/**
 * R4 — Address / PersonAddress (S2), real-DB invariants.
 *
 * The concurrency and constraint cases run against real Postgres — mocked,
 * they would prove only that the code reads well, not that the partial
 * unique index and exclusion constraint actually serialize concurrent
 * writers. See docs/planning/core-admission-lifecycle-specification.md
 * §10.3-10.6.
 */
describe('Address / PersonAddress (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let addresses: AddressService;

  let orgA: string;
  let orgB: string;

  const suffix = Date.now().toString();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    addresses = moduleRef.get(AddressService);

    const make = async (label: string) =>
      (
        await prisma.organization.create({
          data: {
            name: `Address Test ${label}`,
            code: `AT${label}_${suffix}`,
            contactEmail: 'a@test.local',
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
      await prisma.personAddress.deleteMany({ where: { organizationId: org } });
      await prisma.address.deleteMany({ where: { organizationId: org } });
      await prisma.person.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: org } });
    }
    await moduleRef.close();
  });

  const person = async (org: string, dobYear = 2015) =>
    (
      await prisma.person.create({
        data: {
          organizationId: org,
          dob: new Date(`${dobYear}-01-01`),
          nameNormalized: `test person ${Math.random()}`,
        },
      })
    ).id;

  const home = (over: Record<string, unknown> = {}) => ({
    line1: '221B, MG Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    addressType: AddressType.CURRENT,
    ...over,
  });

  describe('sharing and de-duplication', () => {
    it('two persons attaching the same address share one Address row', async () => {
      const p1 = await person(orgA);
      const p2 = await person(orgA);

      const link1 = await addresses.attach(orgA, p1, home(), 'staff-1');
      const link2 = await addresses.attach(orgA, p2, home(), 'staff-1');

      expect(link1.addressId).toBe(link2.addressId);

      const rows = await prisma.address.findMany({
        where: { organizationId: orgA, pincode: '411001', city: 'Pune' },
      });
      expect(rows).toHaveLength(1);
    });

    it('a different pincode produces a distinct Address row', async () => {
      const p1 = await person(orgA);
      const p2 = await person(orgA);

      const link1 = await addresses.attach(orgA, p1, home(), 'staff-1');
      const link2 = await addresses.attach(
        orgA,
        p2,
        home({ pincode: '411002' }),
        'staff-1',
      );

      expect(link1.addressId).not.toBe(link2.addressId);
    });

    it('the same organization + fields never produce two Address rows across separate persons (dedup key holds)', async () => {
      const p1 = await person(orgB);
      const p2 = await person(orgB);
      const p3 = await person(orgB);

      await Promise.all([
        addresses.attach(orgB, p1, home(), 's'),
        addresses.attach(orgB, p2, home(), 's'),
        addresses.attach(orgB, p3, home(), 's'),
      ]);

      const rows = await prisma.address.findMany({
        where: { organizationId: orgB, pincode: '411001' },
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe('organization isolation', () => {
    it('404s attaching an address to a person from another organization', async () => {
      const foreignPerson = await person(orgB);

      await expect(
        addresses.attach(orgA, foreignPerson, home(), 'staff-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s listing addresses for a person from another organization', async () => {
      const foreignPerson = await person(orgB);

      await expect(addresses.list(orgA, foreignPerson)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s resolving an address for a person from another organization', async () => {
      const foreignPerson = await person(orgB);

      await expect(
        addresses.resolve(orgA, foreignPerson, AddressType.CURRENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('history and replacement', () => {
    it('preserves the closed link when a new CURRENT address replaces it', async () => {
      const p = await person(orgA);

      const first = await addresses.attach(orgA, p, home(), 'staff-1');
      const second = await addresses.attach(
        orgA,
        p,
        home({ line1: 'New House', pincode: '411099' }),
        'staff-1',
      );

      const current = await addresses.list(orgA, p);
      expect(current).toHaveLength(1);
      expect(current[0].id).toBe(second.id);

      const full = await addresses.list(orgA, p, true);
      expect(full).toHaveLength(2);
      const closed = full.find((l) => l.id === first.id);
      expect(closed?.validTo).not.toBeNull();
    });

    it('resolve() as-of a past time still returns the address valid then', async () => {
      const p = await person(orgA);

      const first = await addresses.attach(orgA, p, home(), 'staff-1');
      const between = new Date();
      await new Promise((r) => setTimeout(r, 5));
      await addresses.attach(orgA, p, home({ pincode: '411077' }), 'staff-1');

      const asOfPast = await addresses.resolve(
        orgA,
        p,
        AddressType.CURRENT,
        between,
      );
      expect(asOfPast?.addressId).toBe(first.addressId);

      const asOfNow = await addresses.resolve(orgA, p, AddressType.CURRENT);
      expect(asOfNow?.addressId).not.toBe(first.addressId);
    });
  });

  describe('concurrency — the database, not the application, decides', () => {
    it('exactly one of two concurrent attaches for the same person+type commits', async () => {
      const p = await person(orgA);

      const results = await Promise.allSettled([
        addresses.attach(orgA, p, home({ pincode: '411001' }), 's1'),
        addresses.attach(orgA, p, home({ pincode: '411002' }), 's2'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );

      const open = await prisma.personAddress.findMany({
        where: { personId: p, addressType: 'CURRENT', validTo: null },
      });
      expect(open).toHaveLength(1);
    });
  });

  describe('event and audit payloads', () => {
    it('carries no raw address text into the outbox', async () => {
      const p = await person(orgA);
      const link = await addresses.attach(
        orgA,
        p,
        home({ line1: 'Unmistakable Street Name 42' }),
        'staff-1',
      );

      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: p },
      });

      expect(events.length).toBeGreaterThan(0);
      const serialised = JSON.stringify(events);
      expect(serialised).not.toContain('Unmistakable Street Name 42');
      expect(serialised).toContain(link.addressId);
    });

    it('carries no raw address text into the audit log', async () => {
      const p = await person(orgA);
      await addresses.attach(
        orgA,
        p,
        home({ line1: 'Another Unmistakable Lane 7' }),
        'staff-1',
      );
      await moduleRef.get(OutboxRelay).drain();

      const rows = await prisma.auditLog.findMany({
        where: { aggregateId: p },
      });

      expect(JSON.stringify(rows)).not.toContain('Another Unmistakable Lane 7');
    });
  });
});
