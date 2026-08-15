import { ConflictException, NotFoundException } from '@nestjs/common';
import { AddressService } from '@/modules/identity/address/address.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AddressType, Prisma } from '@/generated/client';

/**
 * R4 — Address / PersonAddress (S2).
 *
 * No `Household`: the specification (§9.2, DECIDED S1 D5) explicitly refuses
 * one. Sharing is two `PersonAddress` rows pointing at one immutable
 * `Address`; these tests lock that dedup and the append-only link behaviour
 * in place.
 */
const ORG = 'org-1';
const PERSON = 'person-1';

const dto = (over: Record<string, unknown> = {}) => ({
  line1: '221B, MG Road',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
  addressType: AddressType.CURRENT,
  ...over,
});

describe('AddressService', () => {
  let mockPrisma: any;
  let mockOutbox: { enqueue: jest.Mock };
  let service: AddressService;

  beforeEach(() => {
    mockPrisma = {
      person: { findFirst: jest.fn() },
      address: { findFirst: jest.fn(), create: jest.fn() },
      personAddress: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };
    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new AddressService(
      mockPrisma as PrismaService,
      mockOutbox as unknown as OutboxPublisher,
    );
  });

  describe('attach', () => {
    it('404s when the person is outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.attach(ORG, PERSON, dto(), 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('reuses an existing Address row for the same organization + normalized fields', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1' });
      mockPrisma.personAddress.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.personAddress.create.mockResolvedValue({
        id: 'pa-1',
        addressId: 'addr-1',
      });

      await service.attach(ORG, PERSON, dto(), 'user-1');

      expect(mockPrisma.address.create).not.toHaveBeenCalled();
      expect(mockPrisma.personAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ addressId: 'addr-1' }),
        }),
      );
    });

    it('creates a new Address row when no match exists', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.address.findFirst.mockResolvedValue(null);
      mockPrisma.address.create.mockResolvedValue({ id: 'addr-2' });
      mockPrisma.personAddress.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.personAddress.create.mockResolvedValue({ id: 'pa-2' });

      await service.attach(ORG, PERSON, dto(), 'user-1');

      expect(mockPrisma.address.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG,
            city: 'Pune',
            pincode: '411001',
          }),
        }),
      );
    });

    it('closes any existing open link of the same type before opening a new one', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1' });
      mockPrisma.personAddress.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.personAddress.create.mockResolvedValue({ id: 'pa-3' });

      await service.attach(ORG, PERSON, dto(), 'user-1');

      expect(mockPrisma.personAddress.updateMany).toHaveBeenCalledWith({
        where: { personId: PERSON, addressType: 'CURRENT', validTo: null },
        data: { validTo: expect.any(Date) },
      });
    });

    it('publishes an event with ids and type only, never raw address text', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1' });
      mockPrisma.personAddress.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.personAddress.create.mockResolvedValue({ id: 'pa-4' });

      await service.attach(ORG, PERSON, dto({ line1: 'Secret House' }), 'u1');

      const published = mockOutbox.enqueue.mock.calls[0][0];
      expect(published.payload).toEqual({
        personId: PERSON,
        organizationId: ORG,
        addressId: 'addr-1',
        addressType: 'CURRENT',
        replacedExisting: false,
      });
      expect(JSON.stringify(published.payload)).not.toContain('Secret House');
    });

    it('translates a unique-index race into a structured conflict', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.address.findFirst.mockResolvedValue({ id: 'addr-1' });
      mockPrisma.personAddress.updateMany.mockResolvedValue({ count: 0 });

      mockPrisma.personAddress.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
          meta: { target: ['PersonAddress_person_type_open_key'] },
        }),
      );

      const error: ConflictException = await service
        .attach(ORG, PERSON, dto(), 'user-1')
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        error: 'ADDRESS_LINK_CONFLICT',
      });
    });
  });

  describe('list', () => {
    it('404s when the person is outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(service.list(ORG, PERSON)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('excludes historical links by default', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findMany.mockResolvedValue([]);

      await service.list(ORG, PERSON);

      expect(mockPrisma.personAddress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { personId: PERSON, validTo: null },
        }),
      );
    });

    it('includes historical links on request', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findMany.mockResolvedValue([]);

      await service.list(ORG, PERSON, true);

      expect(mockPrisma.personAddress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { personId: PERSON } }),
      );
    });
  });

  describe('resolve — §10.4', () => {
    it('returns a direct link when one is valid at the given time', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findFirst.mockResolvedValueOnce({
        id: 'pa-1',
        addressType: 'PERMANENT',
      });

      const result = await service.resolve(ORG, PERSON, AddressType.PERMANENT);

      expect(result).toEqual({ id: 'pa-1', addressType: 'PERMANENT' });
    });

    it('falls back COMMUNICATION to CURRENT when unset', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findFirst
        .mockResolvedValueOnce(null) // direct COMMUNICATION
        .mockResolvedValueOnce({ id: 'pa-current', addressType: 'CURRENT' });

      const result = await service.resolve(
        ORG,
        PERSON,
        AddressType.COMMUNICATION,
      );

      expect(result).toEqual({ id: 'pa-current', addressType: 'CURRENT' });
    });

    it('falls back BILLING to CURRENT (guardian-resolution step not implemented)', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findFirst
        .mockResolvedValueOnce(null) // direct BILLING
        .mockResolvedValueOnce({ id: 'pa-current', addressType: 'CURRENT' });

      const result = await service.resolve(ORG, PERSON, AddressType.BILLING);

      expect(result).toEqual({ id: 'pa-current', addressType: 'CURRENT' });
    });

    it('returns null for PERMANENT/CURRENT with nothing set — no fallback exists', async () => {
      mockPrisma.person.findFirst.mockResolvedValue({ id: PERSON });
      mockPrisma.personAddress.findFirst.mockResolvedValue(null);

      const result = await service.resolve(ORG, PERSON, AddressType.CURRENT);

      expect(result).toBeNull();
    });

    it('404s when the person is outside the caller organization', async () => {
      mockPrisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.resolve(ORG, PERSON, AddressType.CURRENT),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
