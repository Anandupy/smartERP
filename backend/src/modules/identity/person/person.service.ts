import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/generated/client';
import { GovernmentIdType, MatchDecision } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { IdentityHashService } from '@/infrastructure/crypto/identity-hash.service';
import { IdentityCryptoService } from '@/infrastructure/crypto/identity-crypto.service';
import { lastFour } from '@/infrastructure/crypto/government-id';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import {
  PersonCreatedEvent,
  PersonGovernmentIdAttachedEvent,
  PersonMatchReviewedEvent,
} from '@/common/events';
import {
  MatchConfidence,
  PersonIdentifiers,
  ResolvedPerson,
  ScoredMatch,
} from './person.types';

const UNIQUE_VIOLATION = 'P2002';

/**
 * The identity index.
 *
 * Answers exactly one question — "is this the same human?" — and deliberately
 * does not answer any other. It knows nothing about students, applicants or
 * guardians, and nothing about how encryption works: it asks
 * `IdentityHashService` for a blind index and `IdentityCryptoService` for
 * ciphertext, and stores what they return.
 *
 * Two operations, kept apart on purpose:
 *
 *   `resolve()`        — deterministic. Same government identifier means the
 *                        same human; return the existing row, silently.
 *   `findCandidates()` — fuzzy. *Might* be the same human; return suggestions
 *                        for a person to judge.
 *
 * Conflating them is why duplicate detection in most systems is either useless
 * or infuriating: the deterministic case gets a warning nobody needs, and the
 * fuzzy case gets a block that rejects twins.
 *
 * See docs/planning/01-identity-core/01-person.md.
 */
@Injectable()
export class PersonService {
  private readonly logger = new Logger(PersonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashes: IdentityHashService,
    private readonly crypto: IdentityCryptoService,
    private readonly outbox: OutboxPublisher,
  ) {}

  /**
   * Find or create the Person for a human, within one organization.
   *
   * Never blocks, never prompts. The caller always gets a usable Person; any
   * fuzzy matches come back alongside it as non-blocking warnings.
   *
   * ## Concurrency
   *
   * The obvious shape — look it up, create it if absent — is a race: twenty
   * concurrent calls all read "no such person" and all insert. The database
   * decides instead. `@@unique([organizationId, govtIdHash])` makes the second
   * insert impossible, and the loser catches the violation and re-reads to find
   * the winner's row.
   *
   * That is deliberately not an application mutex: a mutex is per-process, and
   * the moment a second instance runs it protects nothing.
   */
  async resolve(
    organizationId: string,
    identifiers: PersonIdentifiers,
    tx?: PrismaTransactionClient,
  ): Promise<ResolvedPerson> {
    const client = tx ?? this.prisma;

    const nameNormalized = this.hashes.normalizeName(
      identifiers.firstName,
      identifiers.middleName,
      identifiers.lastName,
    );

    if (!nameNormalized) {
      throw new BadRequestException({
        error: 'PERSON_NAME_REQUIRED',
        message: 'A name is required to resolve an identity.',
      });
    }

    const phoneHash = identifiers.phone
      ? this.hashes.phoneIndex(organizationId, identifiers.phone)
      : null;

    // Normalisation and validation happen here, before anything is stored, so
    // an invalid identifier can never reach the index.
    const government = identifiers.governmentId
      ? this.hashes.governmentIdIndex(
          organizationId,
          identifiers.governmentIdType ?? GovernmentIdType.AADHAAR,
          identifiers.governmentId,
        )
      : null;

    if (government) {
      const existing = await client.person.findFirst({
        where: { organizationId, govtIdHash: government.blindIndex },
        select: { id: true },
      });

      if (existing) {
        // A matching identifier is not a "possible duplicate" to be reviewed.
        // It is the same human. Return the row and say nothing.
        const survivor = await this.resolveSurvivor(existing.id, client);
        return {
          personId: survivor,
          created: false,
          matchedByGovernmentId: true,
          warnings: [],
        };
      }
    }

    const created = await this.insertPerson(
      client,
      {
        organizationId,
        govtIdHash: government?.blindIndex ?? null,
        phoneHash,
        dob: identifiers.dob,
        nameNormalized,
      },
      government,
      identifiers,
      tx,
    );

    // Warnings are computed after the write, never before it: a fuzzy match
    // must not delay or gate creating the identity the caller asked for.
    const warnings = created.created
      ? await this.findCandidates(
          organizationId,
          { ...identifiers, governmentId: null },
          created.personId,
          client,
        )
      : [];

    return { ...created, warnings };
  }

  /**
   * Insert, or adopt the row a concurrent caller inserted first.
   *
   * The unique violation is an expected outcome under contention, not an error
   * condition — so it is handled here and never surfaces to the caller as a
   * database exception.
   *
   * ## Why the savepoint
   *
   * Catching the violation is only half of it. In Postgres a failed statement
   * aborts the whole transaction: every later command returns *"current
   * transaction is aborted"* until it ends. When `resolve()` runs on its own
   * that does not show, because the failed insert *is* the transaction and the
   * re-read starts a new one. Composed inside a caller's transaction — an
   * applicant submission, say — the re-read lands in the aborted one and the
   * caller gets a Prisma error instead of the winner's Person.
   *
   * A savepoint scopes the failure to the insert. Rolling back to it leaves the
   * caller's transaction healthy and everything it had already written intact.
   */
  private async insertPerson(
    client: PrismaTransactionClient,
    data: {
      organizationId: string;
      govtIdHash: string | null;
      phoneHash: string | null;
      dob: Date;
      nameNormalized: string;
    },
    government: { blindIndex: string; normalized: string } | null,
    identifiers: PersonIdentifiers,
    tx?: PrismaTransactionClient,
  ): Promise<Omit<ResolvedPerson, 'warnings'>> {
    // Only meaningful inside a caller's transaction; standalone, the retry has
    // a fresh connection anyway.
    const savepoint =
      tx && data.govtIdHash
        ? `person_resolve_${randomUUID().replace(/-/g, '')}`
        : null;
    if (savepoint) {
      await client.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
    }

    try {
      const person = await client.person.create({ data });

      if (government) {
        await this.writeSensitive(
          client,
          person.id,
          data.organizationId,
          identifiers.governmentIdType ?? GovernmentIdType.AADHAAR,
          government.normalized,
          tx,
        );
      }

      await this.outbox.enqueue(
        new PersonCreatedEvent({
          personId: person.id,
          organizationId: data.organizationId,
          hasGovernmentId: government !== null,
        }),
        client,
      );

      if (savepoint) {
        await client.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
      }

      return {
        personId: person.id,
        created: true,
        matchedByGovernmentId: false,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error) || !data.govtIdHash) throw error;

      if (savepoint) {
        await client.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
      }

      // Someone else won the race. Their row is the answer.
      const winner = await client.person.findFirst({
        where: {
          organizationId: data.organizationId,
          govtIdHash: data.govtIdHash,
        },
        select: { id: true },
      });

      if (!winner) throw error;

      return {
        personId: await this.resolveSurvivor(winner.id, client),
        created: false,
        matchedByGovernmentId: true,
      };
    }
  }

  /**
   * Suggest people who might be the same human.
   *
   * Signals only. Nothing here is grounds for a merge, and this method never
   * writes. A pair already reviewed and recorded `DISTINCT` is excluded, so a
   * clerk who has confirmed a set of twins is not asked again every year.
   */
  async findCandidates(
    organizationId: string,
    identifiers: Partial<PersonIdentifiers>,
    excludePersonId?: string,
    tx?: PrismaTransactionClient,
  ): Promise<ScoredMatch[]> {
    const client = tx ?? this.prisma;
    const matches = new Map<string, ScoredMatch>();

    const record = (
      personId: string,
      confidence: MatchConfidence,
      signal: string,
    ) => {
      if (personId === excludePersonId) return;
      const existing = matches.get(personId);
      if (existing) {
        existing.matchedOn.push(signal);
        if (rank(confidence) > rank(existing.confidence)) {
          existing.confidence = confidence;
        }
        return;
      }
      matches.set(personId, { personId, confidence, matchedOn: [signal] });
    };

    // MEDIUM — a shared household number and the same date of birth. Likely the
    // same human, or a sibling: households share numbers, which is exactly why
    // this is a suggestion rather than a conclusion.
    if (identifiers.phone && identifiers.dob) {
      const phoneHash = this.hashes.phoneIndex(
        organizationId,
        identifiers.phone,
      );
      if (phoneHash) {
        const rows = await client.person.findMany({
          where: {
            organizationId,
            phoneHash,
            dob: identifiers.dob,
            mergedIntoPersonId: null,
          },
          select: { id: true },
          take: 25,
        });
        rows.forEach((r) => record(r.id, MatchConfidence.MEDIUM, 'phone+dob'));
      }
    }

    // LOW — the same normalised name and date of birth. Common names plus a
    // shared birthday are not rare.
    if (identifiers.firstName && identifiers.lastName && identifiers.dob) {
      const nameNormalized = this.hashes.normalizeName(
        identifiers.firstName,
        identifiers.middleName,
        identifiers.lastName,
      );
      if (nameNormalized) {
        const rows = await client.person.findMany({
          where: {
            organizationId,
            nameNormalized,
            dob: identifiers.dob,
            mergedIntoPersonId: null,
          },
          select: { id: true },
          take: 25,
        });
        rows.forEach((r) => record(r.id, MatchConfidence.LOW, 'name+dob'));
      }
    }

    return this.excludeReviewedPairs(
      organizationId,
      excludePersonId,
      Array.from(matches.values()),
      client,
    );
  }

  /**
   * Bind a government identifier to an existing Person.
   *
   * Its own operation rather than a field on a generic update, because the
   * interesting case is not "set a value" — it is that the identifier may
   * already belong to somebody else, and that is a conflict a human has to
   * resolve rather than something to overwrite.
   */
  async attachGovernmentId(
    organizationId: string,
    personId: string,
    type: GovernmentIdType,
    rawValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<{ personId: string; last4: string }> {
    const run = async (client: PrismaTransactionClient) => {
      const person = await client.person.findFirst({
        where: { id: personId, organizationId },
        select: { id: true, govtIdHash: true },
      });

      if (!person) {
        // Out of scope is indistinguishable from absent, deliberately.
        throw new NotFoundException('Person not found');
      }

      const { blindIndex, normalized } = this.hashes.governmentIdIndex(
        organizationId,
        type,
        rawValue,
      );

      if (person.govtIdHash === blindIndex) {
        return { personId: person.id, last4: lastFour(normalized) };
      }

      if (person.govtIdHash) {
        throw new ConflictException({
          error: 'GOVERNMENT_ID_ALREADY_SET',
          message:
            'This identity already has a government identifier. Correcting it is a separate, audited operation.',
        });
      }

      try {
        await client.person.update({
          where: { id: person.id },
          data: { govtIdHash: blindIndex },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          // Names no identifier and no other person: the caller learns that the
          // value is taken, and nothing more.
          throw new ConflictException({
            error: 'GOVERNMENT_ID_ALREADY_ASSOCIATED',
            message:
              'The supplied government identifier is already associated with another identity.',
          });
        }
        throw error;
      }

      await this.writeSensitive(
        client,
        person.id,
        organizationId,
        type,
        normalized,
        client,
      );

      await this.outbox.enqueue(
        new PersonGovernmentIdAttachedEvent({
          personId: person.id,
          organizationId,
          idType: type,
        }),
        client,
      );

      return { personId: person.id, last4: lastFour(normalized) };
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /**
   * Record that a human reviewed two candidates and judged them different.
   *
   * The pair is stored in a canonical order so one comparison cannot be
   * recorded twice under two spellings.
   */
  async recordDistinct(
    organizationId: string,
    personAId: string,
    personBId: string,
    reason: string,
    decidedBy: string,
  ) {
    if (personAId === personBId) {
      throw new BadRequestException({
        error: 'MATCH_DECISION_SELF',
        message: 'An identity cannot be judged distinct from itself.',
      });
    }

    if (!reason?.trim()) {
      throw new BadRequestException({
        error: 'MATCH_DECISION_REASON_REQUIRED',
        message: 'A reason is required when recording a match decision.',
      });
    }

    const [first, second] = [personAId, personBId].sort();

    const found = await this.prisma.person.count({
      where: { organizationId, id: { in: [first, second] } },
    });
    if (found !== 2) {
      throw new NotFoundException('Person not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.personMatchDecision.upsert({
        where: { personAId_personBId: { personAId: first, personBId: second } },
        create: {
          organizationId,
          personAId: first,
          personBId: second,
          decision: MatchDecision.DISTINCT,
          reason: reason.trim(),
          decidedBy,
        },
        update: { reason: reason.trim(), decidedBy },
      });

      await this.outbox.enqueue(
        new PersonMatchReviewedEvent({
          organizationId,
          personAId: first,
          personBId: second,
          decision: MatchDecision.DISTINCT,
        }),
        tx,
      );

      return decision;
    });
  }

  /** Identity linkage for a Person. Never personal detail, never the value. */
  async findOne(organizationId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: {
        id: true,
        organizationId: true,
        dob: true,
        mergedIntoPersonId: true,
        createdAt: true,
        sensitive: {
          select: {
            idType: true,
            aadhaarLast4: true,
            erasedAt: true,
          },
        },
      },
    });

    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  // -------------------------------------------------------------------------

  /**
   * Encrypt and store the identifier.
   *
   * The ciphertext lives on `PersonSensitive`, never on Person: the index is
   * read constantly and the recoverable value almost never, so keeping them
   * apart means an ordinary identity read never touches the table that holds
   * the secret.
   */
  private async writeSensitive(
    client: PrismaTransactionClient,
    personId: string,
    organizationId: string,
    idType: GovernmentIdType,
    normalizedValue: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const { ciphertext, keyVersion } = await this.crypto.encrypt(
      organizationId,
      normalizedValue,
      tx,
    );

    await client.personSensitive.upsert({
      where: { personId },
      create: {
        personId,
        organizationId,
        idType,
        aadhaarEnc: ciphertext,
        aadhaarLast4: lastFour(normalizedValue),
        keyVersion,
      },
      update: {
        idType,
        aadhaarEnc: ciphertext,
        aadhaarLast4: lastFour(normalizedValue),
        keyVersion,
      },
    });
  }

  /**
   * Follow a tombstone to its survivor.
   *
   * Chains are collapsed rather than walked recursively — merge writes A→C
   * directly when B is already merged into C — so this is a single hop by
   * construction. The loop is a guard against a chain that should not exist,
   * not an expected traversal.
   */
  private async resolveSurvivor(
    personId: string,
    client: PrismaTransactionClient,
  ): Promise<string> {
    let current = personId;
    for (let hop = 0; hop < 5; hop += 1) {
      const row = await client.person.findUnique({
        where: { id: current },
        select: { mergedIntoPersonId: true },
      });
      if (!row?.mergedIntoPersonId) return current;
      current = row.mergedIntoPersonId;
    }
    this.logger.error(`Merge chain too deep starting at person ${personId}`);
    return current;
  }

  private async excludeReviewedPairs(
    organizationId: string,
    subjectId: string | undefined,
    candidates: ScoredMatch[],
    client: PrismaTransactionClient,
  ): Promise<ScoredMatch[]> {
    if (!subjectId || candidates.length === 0) return candidates;

    const pairs = candidates.map((c) => [subjectId, c.personId].sort());
    const reviewed = await client.personMatchDecision.findMany({
      where: {
        organizationId,
        OR: pairs.map(([a, b]) => ({ personAId: a, personBId: b })),
      },
      select: { personAId: true, personBId: true },
    });

    if (reviewed.length === 0) return candidates;

    const dismissed = new Set(
      reviewed.map((r) => `${r.personAId}|${r.personBId}`),
    );

    return candidates.filter((c) => {
      const [a, b] = [subjectId, c.personId].sort();
      return !dismissed.has(`${a}|${b}`);
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    );
  }
}

function rank(confidence: MatchConfidence): number {
  return confidence === MatchConfidence.HIGH
    ? 3
    : confidence === MatchConfidence.MEDIUM
      ? 2
      : 1;
}
