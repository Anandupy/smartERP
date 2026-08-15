import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AddressType,
  AddressVerificationStatus,
  Prisma,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { PersonAddressAttachedEvent } from '@/common/events';
import { AttachAddressDto } from './dto/address.dto';

const UNIQUE_VIOLATION = 'P2002';

/**
 * S2 — Address / PersonAddress.
 *
 * `Address` is an immutable value object; this service never updates one,
 * only finds-or-creates by `(organizationId, normalizedHash)`. `PersonAddress`
 * is an append-only link: attaching a new address of a type that already has
 * an open link closes the old one and opens a new one, inside one
 * transaction. Both together are what give sharing (many PersonAddress rows
 * pointing at one Address) and history (a move never edits anything, only
 * adds) simultaneously.
 *
 * See docs/planning/core-admission-lifecycle-specification.md §10.3-10.6.
 */
@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxPublisher,
  ) {}

  /**
   * Attach an address to a Person, replacing any existing open link of the
   * same `addressType`.
   *
   * ## Concurrency
   *
   * Two concurrent attaches for the same person+type both read "no open
   * link", both try to insert one, and the partial unique index
   * (`PersonAddress_person_type_open_key`) lets exactly one commit. The
   * loser's transaction rolls back entirely — unlike `PersonService.resolve()`
   * there is no well-defined "winner" to adopt here, since the two requests
   * may carry genuinely different addresses. The caller retries.
   */
  async attach(
    organizationId: string,
    personId: string,
    dto: AttachAddressDto,
    verifiedBy: string,
  ) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: { id: true },
    });
    if (!person) {
      // Out of scope is indistinguishable from absent, deliberately.
      throw new NotFoundException('Person not found');
    }

    const countryCode = dto.countryCode?.trim().toUpperCase() || 'IN';
    const normalized = {
      line1: dto.line1.trim(),
      line2: dto.line2?.trim() || null,
      landmark: dto.landmark?.trim() || null,
      city: dto.city.trim(),
      district: dto.district?.trim() || null,
      state: dto.state.trim(),
      countryCode,
      pincode: dto.pincode.trim(),
    };
    const normalizedHash = this.hash(normalized);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const address = await this.findOrCreateAddress(
          tx,
          organizationId,
          normalized,
          normalizedHash,
          dto.latitude ?? null,
          dto.longitude ?? null,
        );

        const closed = await tx.personAddress.updateMany({
          where: { personId, addressType: dto.addressType, validTo: null },
          data: { validTo: new Date() },
        });

        const link = await tx.personAddress.create({
          data: {
            organizationId,
            personId,
            addressId: address.id,
            addressType: dto.addressType,
            verificationStatus: AddressVerificationStatus.VERIFIED,
            verifiedBy,
            verifiedAt: new Date(),
            changeReason: dto.changeReason?.trim() || null,
          },
          include: { address: true },
        });

        await this.outbox.enqueue(
          new PersonAddressAttachedEvent({
            personId,
            organizationId,
            addressId: address.id,
            addressType: dto.addressType,
            replacedExisting: closed.count > 0,
          }),
          tx,
        );

        return link;
      });
    } catch (error) {
      if (this.isConflict(error)) {
        throw new ConflictException({
          error: 'ADDRESS_LINK_CONFLICT',
          message:
            'Another address change for this person and type happened concurrently. Retry the request.',
        });
      }
      throw error;
    }
  }

  /**
   * List `PersonAddress` links for a Person, most recent first.
   *
   * Historical (closed) links are included only on request — the ordinary
   * case is "what does this person's address look like right now".
   */
  async list(
    organizationId: string,
    personId: string,
    includeHistorical = false,
  ) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return this.prisma.personAddress.findMany({
      where: {
        personId,
        ...(includeHistorical ? {} : { validTo: null }),
      },
      include: { address: true },
      orderBy: { validFrom: 'desc' },
    });
  }

  /**
   * Resolve the address of a given type for a Person, per §10.4.
   *
   * `COMMUNICATION` falls back to `CURRENT` when unset. `BILLING` is
   * specified to resolve through the ward's financial guardian and then
   * their `CURRENT` — that step is **not implemented**: it depends on
   * Guardian carrying a `personId`, which it does not yet (verified against
   * the schema; the migration that was supposed to add it has not landed
   * despite being marked complete in phase history). Until then `BILLING`
   * resolves to a direct link or falls back to `CURRENT`, same as
   * `COMMUNICATION`.
   */
  async resolve(
    organizationId: string,
    personId: string,
    type: AddressType,
    asOf: Date = new Date(),
  ) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    const direct = await this.findValidAt(personId, type, asOf);
    if (direct) return direct;

    if (type === 'COMMUNICATION' || type === 'BILLING') {
      return this.findValidAt(personId, 'CURRENT', asOf);
    }

    return null;
  }

  private async findValidAt(personId: string, type: AddressType, asOf: Date) {
    return this.prisma.personAddress.findFirst({
      where: {
        personId,
        addressType: type,
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gt: asOf } }],
      },
      include: { address: true },
      orderBy: { validFrom: 'desc' },
    });
  }

  private async findOrCreateAddress(
    tx: PrismaTransactionClient,
    organizationId: string,
    normalized: {
      line1: string;
      line2: string | null;
      landmark: string | null;
      city: string;
      district: string | null;
      state: string;
      countryCode: string;
      pincode: string;
    },
    normalizedHash: string,
    latitude: number | null,
    longitude: number | null,
  ) {
    const existing = await tx.address.findFirst({
      where: { organizationId, normalizedHash },
    });
    if (existing) return existing;

    return tx.address.create({
      data: {
        organizationId,
        normalizedHash,
        latitude,
        longitude,
        ...normalized,
      },
    });
  }

  /** Comparison key only — trimmed, case-folded, whitespace-collapsed. */
  private hash(fields: Record<string, string | null>): string {
    const canonical = Object.values(fields)
      .map((v) => (v ?? '').toLowerCase().trim().replace(/\s+/g, ' '))
      .join('|');
    return createHash('sha256').update(canonical).digest('hex');
  }

  private isConflict(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      return true;
    }
    // The overlap-prevention exclusion constraint is not one Prisma's own
    // schema declares, so a violation surfaces as a raw database error
    // rather than a recognised Prisma error code.
    return (
      error instanceof Error &&
      error.message.includes('PersonAddress_no_overlapping_windows')
    );
  }
}
