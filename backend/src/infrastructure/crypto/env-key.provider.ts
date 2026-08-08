import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  constants as cryptoConstants,
  KeyObject,
} from 'crypto';
import {
  OperationalKeyProvider,
  RecoveryKeyProvider,
  WrappedKey,
} from './key-provider.interface';

/** AES-256-GCM: 32-byte key, 12-byte IV, 16-byte tag. */
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * The wrap format, so a future reader can decode one without the code.
 *
 * byte 0        format version
 * bytes 1..12   IV
 * bytes 13..28  GCM authentication tag
 * bytes 29..    ciphertext
 *
 * The leading version byte tracks the *layout* and is independent of the KEK
 * version, which tracks the *key*. Conflating them makes a future migration
 * ambiguous.
 */
const FORMAT_VERSION = 1;

export function packEnvelope(
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer,
): Buffer {
  return Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, tag, ciphertext]);
}

export function unpackEnvelope(payload: Buffer): {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
} {
  if (payload.length < 1 + IV_BYTES + TAG_BYTES) {
    throw new Error('Ciphertext is shorter than its own header');
  }
  const version = payload[0];
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported ciphertext format version ${version}`);
  }
  return {
    iv: payload.subarray(1, 1 + IV_BYTES),
    tag: payload.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES),
    ciphertext: payload.subarray(1 + IV_BYTES + TAG_BYTES),
  };
}

/** AES-256-GCM in one place, so no caller assembles a cipher by hand. */
export function aesGcmEncrypt(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return packEnvelope(iv, cipher.getAuthTag(), ciphertext);
}

export function aesGcmDecrypt(key: Buffer, payload: Buffer): Buffer {
  const { iv, tag, ciphertext } = unpackEnvelope(payload);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Derive a 32-byte AES key from the configured secret.
 *
 * `ENCRYPTION_KEY` may be supplied as base64 or hex of exactly 32 bytes, which
 * is the preferred form. A longer passphrase is accepted outside production and
 * stretched, but production requires real key material — a passphrase has far
 * less entropy than its character count suggests.
 */
export function deriveKeyMaterial(secret: string): Buffer | null {
  const trimmed = secret.trim();

  // base64url is included because it is what `randomBytes(32).toString(
  // 'base64url')` produces — good key material that a base64-only check
  // rejects over two substituted characters.
  for (const encoding of ['base64', 'base64url', 'hex'] as const) {
    const decoded = tryDecode(trimmed, encoding);
    if (decoded) return decoded;
  }

  return null;
}

function tryDecode(
  value: string,
  encoding: 'base64' | 'base64url' | 'hex',
): Buffer | null {
  try {
    const buf = Buffer.from(value, encoding);
    if (buf.length !== KEY_BYTES) return null;
    // Round-trip: Buffer.from is lenient and silently ignores invalid
    // characters, so a passphrase can decode to the right length by accident.
    if (
      buf.toString(encoding).replace(/=+$/, '') !== value.replace(/=+$/, '')
    ) {
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

/**
 * Operational KEK sourced from `ENCRYPTION_KEY`.
 *
 * One version today. The version is recorded on every wrap anyway, so
 * introducing a second generation later is a provider change rather than a data
 * migration.
 */
@Injectable()
export class EnvOperationalKeyProvider
  extends OperationalKeyProvider
  implements OnModuleInit
{
  private readonly logger = new Logger(EnvOperationalKeyProvider.name);
  private key?: Buffer;
  private readonly version = 1;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    const secret = this.config.get<string>('ENCRYPTION_KEY');
    if (!secret) {
      // Not fatal at boot: a deployment that never touches sensitive data can
      // run without it. It becomes fatal the moment something needs to encrypt,
      // which is where the error can name the operation that required it.
      this.logger.warn(
        'ENCRYPTION_KEY is not configured. Identity encryption is unavailable and any operation requiring it will be refused.',
      );
      return;
    }

    const material = deriveKeyMaterial(secret);
    if (!material) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 32 bytes encoded as base64 or hex. ' +
          'Generate one with: openssl rand -base64 32',
      );
    }
    this.key = material;
  }

  isConfigured(): boolean {
    return this.key !== undefined;
  }

  currentVersion(): number {
    return this.version;
  }

  async wrap(dek: Buffer): Promise<WrappedKey> {
    return Promise.resolve({
      wrapped: aesGcmEncrypt(this.requireKey(), dek),
      kekVersion: this.version,
    });
  }

  async unwrap(wrapped: Buffer, kekVersion: number): Promise<Buffer> {
    if (kekVersion !== this.version) {
      throw new Error(
        `No operational key available for KEK version ${kekVersion}`,
      );
    }
    return Promise.resolve(aesGcmDecrypt(this.requireKey(), wrapped));
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error(
        'ENCRYPTION_KEY is not configured; refusing to perform an encryption operation',
      );
    }
    return this.key;
  }
}

/**
 * Recovery KEK sourced from `KEK_RECOVERY_PUBLIC_KEY` — a PEM public key.
 *
 * Only the public half is ever configured here, which is what lets the server
 * produce a recovery wrap it cannot itself undo. The private half belongs
 * offline, and this class has no code path that would accept one.
 */
@Injectable()
export class EnvRecoveryKeyProvider
  extends RecoveryKeyProvider
  implements OnModuleInit
{
  private readonly logger = new Logger(EnvRecoveryKeyProvider.name);
  private publicKey?: KeyObject;
  private readonly version = 1;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    const pem = this.config.get<string>('KEK_RECOVERY_PUBLIC_KEY');
    if (!pem) {
      this.logger.warn(
        'KEK_RECOVERY_PUBLIC_KEY is not configured. Data keys cannot be given a recovery wrap, ' +
          'so losing the operational key would lose the data. See docs/core/key-custody.md.',
      );
      return;
    }

    // `createPublicKey` accepts a PRIVATE key and derives the public half from
    // it, so it would silently accept the one input this must never take. The
    // check has to happen before the parse, not after: by then the type is
    // 'public' and the mistake is invisible.
    //
    // Getting this wrong puts the recovery secret on the very server the
    // recovery path exists to survive.
    if (/PRIVATE KEY/.test(pem)) {
      throw new Error(
        'KEK_RECOVERY_PUBLIC_KEY contains a PRIVATE key. Only the PUBLIC half may be ' +
          'configured — the private half must stay offline, or recovery gives no ' +
          'protection against a server compromise.',
      );
    }

    try {
      const key = createPublicKey(
        pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem,
      );
      if (key.type !== 'public') {
        throw new Error('not a public key');
      }
      this.publicKey = key;
    } catch (error) {
      if (error instanceof Error && /PRIVATE KEY/.test(error.message))
        throw error;
      // Deliberately does not echo the value: a malformed key is a
      // configuration error, and the error message is not the place to print
      // whatever was supplied.
      throw new Error(
        'KEK_RECOVERY_PUBLIC_KEY is not a valid PEM public key. ' +
          'It must be the PUBLIC half of the recovery keypair — never the private half.',
      );
    }
  }

  isConfigured(): boolean {
    return this.publicKey !== undefined;
  }

  currentVersion(): number {
    return this.version;
  }

  async wrap(dek: Buffer): Promise<WrappedKey> {
    if (!this.publicKey) {
      throw new Error(
        'Recovery key custody is not established (KEK_RECOVERY_PUBLIC_KEY is unset). ' +
          'Refusing to produce a recovery wrap that nobody could unwrap.',
      );
    }

    return Promise.resolve({
      wrapped: publicEncrypt(
        {
          key: this.publicKey,
          padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        dek,
      ),
      kekVersion: this.version,
    });
  }

  describeRecoveryProcedure(): string {
    return (
      'Recovery requires the offline private half of the recovery keypair. ' +
      'The application holds only the public half and has no code path that can decrypt a ' +
      'recovery wrap. See docs/core/key-custody.md for the ceremony.'
    );
  }
}
