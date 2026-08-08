import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { DataKeyStatus } from '@/generated/client';
import {
  OperationalKeyProvider,
  RecoveryKeyProvider,
} from './key-provider.interface';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  EnvOperationalKeyProvider,
} from './env-key.provider';

/** A value encrypted under an organization's data key. */
export interface EncryptedValue {
  ciphertext: Buffer;
  keyVersion: number;
}

/**
 * Envelope encryption for tenant-scoped sensitive values.
 *
 * Nothing above this class knows how encryption works. `PersonService` asks for
 * a value to be encrypted and gets back ciphertext plus the key version that
 * produced it; it never sees a cipher, an IV or a key.
 *
 * The DEK is per organization, held only in wrapped form, and unwrapped into
 * process memory for the duration of one operation. It is never logged and
 * never returned.
 *
 * See docs/planning/00-foundation/01-data-protection.md.
 */
@Injectable()
export class IdentityCryptoService {
  private readonly logger = new Logger(IdentityCryptoService.name);

  /**
   * Unwrapped DEKs, keyed by organization.
   *
   * Unwrapping on every field would make a bulk read a per-row KEK operation.
   * The cache holds key material in memory, which is the same exposure the
   * operational key already has — it is not an additional class of risk, and it
   * is cleared on shred.
   */
  private readonly dekCache = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly operationalKeys: OperationalKeyProvider,
    private readonly recoveryKeys: RecoveryKeyProvider,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Encrypt a value under the organization's data key, provisioning the key on
   * first use.
   */
  async encrypt(
    organizationId: string,
    plaintext: string,
    tx?: PrismaTransactionClient,
  ): Promise<EncryptedValue> {
    const { dek, keyVersion } = await this.resolveDek(organizationId, tx);
    return {
      ciphertext: aesGcmEncrypt(dek, Buffer.from(plaintext, 'utf8')),
      keyVersion,
    };
  }

  /**
   * Decrypt a value.
   *
   * A failure here is deliberately opaque to the caller. Distinguishing "wrong
   * key" from "tampered ciphertext" from "wrong version" tells an attacker
   * which of those they achieved; the operator gets the detail in the log, and
   * the caller gets one error.
   */
  async decrypt(
    organizationId: string,
    ciphertext: Buffer,
    keyVersion: number,
    tx?: PrismaTransactionClient,
  ): Promise<string> {
    const { dek, keyVersion: current } = await this.resolveDek(
      organizationId,
      tx,
    );

    if (keyVersion !== current) {
      // Every stored ciphertext records its version, so a rotation that has not
      // re-encrypted everything is a real state rather than a bug — but this
      // deployment has one generation, so a mismatch means something is wrong.
      this.logger.error(
        `Ciphertext for organization ${organizationId} names key version ${keyVersion}; current is ${current}`,
      );
      throw new InternalServerErrorException({
        error: 'SENSITIVE_DECRYPT_FAILED',
        message: 'The stored value could not be read.',
      });
    }

    try {
      return aesGcmDecrypt(dek, ciphertext).toString('utf8');
    } catch (error) {
      this.logger.error(
        `Authenticated decryption failed for organization ${organizationId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      throw new InternalServerErrorException({
        error: 'SENSITIVE_DECRYPT_FAILED',
        message: 'The stored value could not be read.',
      });
    }
  }

  /**
   * Whether this deployment can encrypt at all.
   *
   * Callers use it to fail with a configuration error rather than a crypto one.
   */
  isAvailable(): boolean {
    return this.operationalKeys instanceof EnvOperationalKeyProvider
      ? this.operationalKeys.isConfigured()
      : true;
  }

  /** What is missing, for a startup or health report. Never the values. */
  describeReadiness(): {
    operationalKey: boolean;
    recoveryCustody: boolean;
    productionReady: boolean;
  } {
    const operationalKey = this.isAvailable();
    const recoveryCustody = this.recoveryKeys.isConfigured();
    return {
      operationalKey,
      recoveryCustody,
      productionReady: operationalKey && recoveryCustody,
    };
  }

  /**
   * Crypto-erasure for one subject.
   *
   * Nulls the ciphertext in place. The Person row, the academic record and
   * every foreign key survive — only the recoverable value goes. This is what
   * lets a statutory erasure request be honoured without deleting a student's
   * twelve-year history.
   *
   * The blind index is deliberately **retained**: it holds no recoverable
   * value, and dropping it would let an erased subject re-enrol as a stranger
   * and acquire a second identity.
   */
  async cryptoEraseSubject(
    personId: string,
    erasedBy: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.personSensitive.updateMany({
      where: { personId, erasedAt: null },
      data: {
        aadhaarEnc: null,
        aadhaarLast4: null,
        erasedAt: new Date(),
        erasedBy,
      },
    });
  }

  /**
   * Find or provision the organization's data key.
   *
   * Provisioning is the point where recovery custody is enforced. A key with
   * only an operational wrap is survivable in development and unacceptable in
   * production, because losing `ENCRYPTION_KEY` would then lose every tenant's
   * sensitive data with no second path to it.
   */
  private async resolveDek(
    organizationId: string,
    tx?: PrismaTransactionClient,
  ): Promise<{ dek: Buffer; keyVersion: number }> {
    const client = tx ?? this.prisma;

    const cached = this.dekCache.get(organizationId);
    const existing = await client.organizationDataKey.findUnique({
      where: { organizationId },
    });

    if (existing) {
      if (existing.status === DataKeyStatus.SHREDDED) {
        throw new InternalServerErrorException({
          error: 'DATA_KEY_SHREDDED',
          message:
            'This organization’s data key has been destroyed; encrypted values are permanently unreadable.',
        });
      }

      if (this.isProduction && !existing.dekWrappedRecovery) {
        throw new InternalServerErrorException({
          error: 'KEY_RECOVERY_CUSTODY_REQUIRED',
          message:
            'This organization’s data key has no recovery wrap. Refusing to operate on sensitive data in production. See docs/core/key-custody.md.',
        });
      }

      if (cached) {
        return { dek: cached, keyVersion: existing.operationalKekVersion };
      }

      const dek = await this.operationalKeys.unwrap(
        Buffer.from(existing.dekWrappedOperational),
        existing.operationalKekVersion,
      );
      this.dekCache.set(organizationId, dek);
      return { dek, keyVersion: existing.operationalKekVersion };
    }

    return this.provisionDek(organizationId, client);
  }

  private async provisionDek(
    organizationId: string,
    client: PrismaTransactionClient,
  ): Promise<{ dek: Buffer; keyVersion: number }> {
    if (!this.isAvailable()) {
      throw new InternalServerErrorException({
        error: 'ENCRYPTION_NOT_CONFIGURED',
        message:
          'Sensitive data handling is not configured for this deployment (ENCRYPTION_KEY is unset).',
      });
    }

    const recoveryConfigured = this.recoveryKeys.isConfigured();

    if (this.isProduction && !recoveryConfigured) {
      // The alternative is provisioning a key whose only copy of the wrap sits
      // next to the data it protects, and calling that recoverable.
      throw new InternalServerErrorException({
        error: 'KEY_RECOVERY_CUSTODY_REQUIRED',
        message:
          'Recovery key custody is not established (KEK_RECOVERY_PUBLIC_KEY is unset). ' +
          'Refusing to provision a data key in production. See docs/core/key-custody.md.',
      });
    }

    const dek = randomBytes(32);
    const operational = await this.operationalKeys.wrap(dek);
    const recovery = recoveryConfigured
      ? await this.recoveryKeys.wrap(dek)
      : null;

    if (!recoveryConfigured) {
      this.logger.warn(
        `Provisioning a data key for organization ${organizationId} WITHOUT a recovery wrap. ` +
          'This is permitted outside production only. Losing ENCRYPTION_KEY would lose this data.',
      );
    }

    // Two callers provisioning concurrently must not produce two keys, and the
    // loser must adopt the winner's rather than encrypting under a key that is
    // about to be discarded.
    await client.organizationDataKey.upsert({
      where: { organizationId },
      create: {
        organizationId,
        dekWrappedOperational: operational.wrapped,
        operationalKekVersion: operational.kekVersion,
        dekWrappedRecovery: recovery?.wrapped ?? null,
        recoveryKekVersion: recovery?.kekVersion ?? null,
        status: recovery
          ? DataKeyStatus.ACTIVE
          : DataKeyStatus.PENDING_RECOVERY_CUSTODY,
      },
      update: {},
    });

    const stored = await client.organizationDataKey.findUniqueOrThrow({
      where: { organizationId },
    });

    const effective = await this.operationalKeys.unwrap(
      Buffer.from(stored.dekWrappedOperational),
      stored.operationalKekVersion,
    );
    this.dekCache.set(organizationId, effective);

    return { dek: effective, keyVersion: stored.operationalKekVersion };
  }

  /** Drop cached key material — used after a shred, and by tests. */
  forget(organizationId?: string): void {
    if (organizationId) this.dekCache.delete(organizationId);
    else this.dekCache.clear();
  }
}
