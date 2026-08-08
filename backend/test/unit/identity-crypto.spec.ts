import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKeyMaterial,
  EnvOperationalKeyProvider,
  EnvRecoveryKeyProvider,
} from '@/infrastructure/crypto/env-key.provider';
import { IdentityHashService } from '@/infrastructure/crypto/identity-hash.service';
import {
  normalizeGovernmentId,
  normalizeName,
  normalizePhone,
  lastFour,
} from '@/infrastructure/crypto/government-id';
import {
  maskAadhaar,
  maskEmail,
  maskPhone,
  redact,
} from '@/infrastructure/crypto/masking.util';
import { GovernmentIdType } from '@/generated/client';

const configWith = (values: Record<string, string | undefined>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

const PEPPER = 'a'.repeat(48);
const KEY_B64 = randomBytes(32).toString('base64');

describe('Identity crypto', () => {
  describe('key material', () => {
    it('accepts base64, base64url and hex encodings of 32 bytes', () => {
      const raw = randomBytes(32);
      expect(deriveKeyMaterial(raw.toString('base64'))).toEqual(raw);
      // base64url is what randomBytes(32).toString('base64url') produces, and
      // rejecting it over two substituted characters breaks a valid key.
      expect(deriveKeyMaterial(raw.toString('base64url'))).toEqual(raw);
      expect(deriveKeyMaterial(raw.toString('hex'))).toEqual(raw);
    });

    it('rejects a passphrase that merely happens to be long', () => {
      // 43 characters, no encoding — the shape a length check would wave through.
      expect(deriveKeyMaterial('correct horse battery staple correct horse!')).toBeNull();
    });

    it('rejects the wrong number of bytes', () => {
      expect(deriveKeyMaterial(randomBytes(16).toString('base64'))).toBeNull();
      expect(deriveKeyMaterial(randomBytes(64).toString('hex'))).toBeNull();
    });
  });

  describe('authenticated encryption', () => {
    const key = randomBytes(32);

    it('round-trips a value', () => {
      const plaintext = Buffer.from('987654321012', 'utf8');
      expect(aesGcmDecrypt(key, aesGcmEncrypt(key, plaintext))).toEqual(plaintext);
    });

    it('produces different ciphertext for the same plaintext', () => {
      const plaintext = Buffer.from('987654321012', 'utf8');
      const a = aesGcmEncrypt(key, plaintext);
      const b = aesGcmEncrypt(key, plaintext);
      // A random IV per encryption. Ciphertext equality must never be a way to
      // test plaintext equality — that is the blind index's job.
      expect(a.equals(b)).toBe(false);
      expect(aesGcmDecrypt(key, a)).toEqual(aesGcmDecrypt(key, b));
    });

    it('refuses a tampered ciphertext rather than returning garbage', () => {
      const payload = aesGcmEncrypt(key, Buffer.from('987654321012'));
      payload[payload.length - 1] ^= 0xff;
      // GCM is authenticated: this is the difference between a loud failure and
      // a plausible wrong answer.
      expect(() => aesGcmDecrypt(key, payload)).toThrow();
    });

    it('refuses the wrong key', () => {
      const payload = aesGcmEncrypt(key, Buffer.from('987654321012'));
      expect(() => aesGcmDecrypt(randomBytes(32), payload)).toThrow();
    });

    it('refuses an unknown format version', () => {
      const payload = aesGcmEncrypt(key, Buffer.from('987654321012'));
      payload[0] = 99;
      expect(() => aesGcmDecrypt(key, payload)).toThrow(/format version/i);
    });
  });

  describe('operational key provider', () => {
    it('refuses to operate when unconfigured, rather than falling back', async () => {
      const provider = new EnvOperationalKeyProvider(configWith({}));
      provider.onModuleInit();
      expect(provider.isConfigured()).toBe(false);
      await expect(provider.wrap(randomBytes(32))).rejects.toThrow(
        /not configured/i,
      );
    });

    it('rejects a malformed key at boot without echoing it', () => {
      const provider = new EnvOperationalKeyProvider(
        configWith({ ENCRYPTION_KEY: 'not-a-key' }),
      );
      try {
        provider.onModuleInit();
        fail('expected a configuration error');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toMatch(/32 bytes/);
        expect(message).not.toContain('not-a-key');
      }
    });

    it('wraps and unwraps a data key', async () => {
      const provider = new EnvOperationalKeyProvider(
        configWith({ ENCRYPTION_KEY: KEY_B64 }),
      );
      provider.onModuleInit();

      const dek = randomBytes(32);
      const wrapped = await provider.wrap(dek);
      expect(wrapped.kekVersion).toBe(provider.currentVersion());
      expect(await provider.unwrap(wrapped.wrapped, wrapped.kekVersion)).toEqual(
        dek,
      );
    });

    it('refuses a key version it does not hold', async () => {
      const provider = new EnvOperationalKeyProvider(
        configWith({ ENCRYPTION_KEY: KEY_B64 }),
      );
      provider.onModuleInit();
      const wrapped = await provider.wrap(randomBytes(32));
      await expect(provider.unwrap(wrapped.wrapped, 99)).rejects.toThrow(
        /KEK version 99/,
      );
    });
  });

  describe('recovery key provider', () => {
    it('reports custody as unestablished when unconfigured', () => {
      const provider = new EnvRecoveryKeyProvider(configWith({}));
      provider.onModuleInit();
      expect(provider.isConfigured()).toBe(false);
    });

    it('refuses to invent a wrap nobody could unwrap', async () => {
      const provider = new EnvRecoveryKeyProvider(configWith({}));
      provider.onModuleInit();
      // The failure mode this prevents: a placeholder wrap that looks like
      // protection and is not.
      await expect(provider.wrap(randomBytes(32))).rejects.toThrow(
        /custody is not established/i,
      );
    });

    it('rejects a private key supplied where the public half belongs', () => {
      const { generateKeyPairSync } = require('crypto');
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

      const provider = new EnvRecoveryKeyProvider(
        configWith({ KEK_RECOVERY_PUBLIC_KEY: pem }),
      );
      // Accepting it would put the recovery secret on the very server the
      // recovery path is supposed to survive.
      expect(() => provider.onModuleInit()).toThrow(/public/i);
    });

    it('wraps with a public key when custody is established', async () => {
      const { generateKeyPairSync } = require('crypto');
      const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      const provider = new EnvRecoveryKeyProvider(
        configWith({ KEK_RECOVERY_PUBLIC_KEY: pem }),
      );
      provider.onModuleInit();

      expect(provider.isConfigured()).toBe(true);
      const wrapped = await provider.wrap(randomBytes(32));
      expect(wrapped.wrapped.length).toBeGreaterThan(0);
    });

    it('has no code path that can decrypt a recovery wrap', () => {
      const provider = new EnvRecoveryKeyProvider(configWith({}));
      expect(provider.describeRecoveryProcedure()).toMatch(/offline/i);
      expect(
        (provider as unknown as Record<string, unknown>).unwrap,
      ).toBeUndefined();
    });
  });
});

describe('Government identifier normalization', () => {
  it('canonicalises the same identifier written differently', () => {
    const spaced = normalizeGovernmentId(GovernmentIdType.AADHAAR, '9876 5432 1012');
    const dashed = normalizeGovernmentId(GovernmentIdType.AADHAAR, '9876-5432-1012');
    const plain = normalizeGovernmentId(GovernmentIdType.AADHAAR, '987654321012');
    expect(spaced).toBe(plain);
    expect(dashed).toBe(plain);
  });

  it('rejects malformed input rather than normalising garbage', () => {
    for (const bad of ['', '12345', '98765432101', '9876543210123', 'abcd12345678']) {
      expect(() =>
        normalizeGovernmentId(GovernmentIdType.AADHAAR, bad),
      ).toThrow();
    }
  });

  it('rejects the leading digits UIDAI never issues', () => {
    expect(() =>
      normalizeGovernmentId(GovernmentIdType.AADHAAR, '012345678901'),
    ).toThrow();
    expect(() =>
      normalizeGovernmentId(GovernmentIdType.AADHAAR, '112345678901'),
    ).toThrow();
  });

  it('never echoes the rejected value back to the caller', () => {
    try {
      normalizeGovernmentId(GovernmentIdType.AADHAAR, '123456789999');
      fail('expected rejection');
    } catch (error) {
      expect(JSON.stringify((error as any).response)).not.toContain(
        '123456789999',
      );
    }
  });

  it('reduces a contact number to its last ten digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('098765 43210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone('123')).toBeNull();
  });

  it('folds case, accents and punctuation out of a name', () => {
    expect(normalizeName('Riya', null, 'Sharma')).toBe('riya sharma');
    expect(normalizeName('  RIYA  ', 'A.', 'Sharma ')).toBe('riya a sharma');
    expect(normalizeName('Rêña', undefined, "O'Brien")).toBe('rena obrien');
  });
});

describe('Blind index', () => {
  const hashes = (pepper?: string) => {
    const svc = new IdentityHashService(
      configWith({ IDENTITY_HASH_PEPPER: pepper }),
    );
    svc.onModuleInit();
    return svc;
  };

  it('is stable for the same organization and canonical value', () => {
    const svc = hashes(PEPPER);
    const a = svc.governmentIdIndex('org-1', GovernmentIdType.AADHAAR, '9876 5432 1012');
    const b = svc.governmentIdIndex('org-1', GovernmentIdType.AADHAAR, '987654321012');
    // Determinism is the point: a per-record salt would make lookup impossible.
    expect(a.blindIndex).toBe(b.blindIndex);
  });

  it('differs across organizations for the same identifier', () => {
    const svc = hashes(PEPPER);
    const a = svc.governmentIdIndex('org-1', GovernmentIdType.AADHAAR, '987654321012');
    const b = svc.governmentIdIndex('org-2', GovernmentIdType.AADHAAR, '987654321012');
    // The organization is inside the HMAC message, not merely the query scope,
    // so holding both databases still reveals no correlation.
    expect(a.blindIndex).not.toBe(b.blindIndex);
  });

  it('separates domains so a phone cannot collide with an identifier', () => {
    const svc = hashes(PEPPER);
    const asId = svc.governmentIdIndex('org-1', GovernmentIdType.AADHAAR, '987654321012');
    const asPhone = svc.phoneIndex('org-1', '987654321012');
    expect(asId.blindIndex).not.toBe(asPhone);
  });

  it('depends on the pepper', () => {
    const a = hashes(PEPPER).governmentIdIndex(
      'org-1',
      GovernmentIdType.AADHAAR,
      '987654321012',
    );
    const b = hashes('b'.repeat(48)).governmentIdIndex(
      'org-1',
      GovernmentIdType.AADHAAR,
      '987654321012',
    );
    // Unkeyed SHA-256 over a 12-digit space is enumerable in minutes. The
    // pepper is what makes the digest non-reversible in practice.
    expect(a.blindIndex).not.toBe(b.blindIndex);
  });

  it('is not the identifier in any recoverable form', () => {
    const svc = hashes(PEPPER);
    const { blindIndex } = svc.governmentIdIndex(
      'org-1',
      GovernmentIdType.AADHAAR,
      '987654321012',
    );
    expect(blindIndex).not.toContain('987654321012');
    expect(blindIndex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to compute anything when the pepper is absent', () => {
    const svc = hashes(undefined);
    expect(svc.isConfigured()).toBe(false);
    expect(() =>
      svc.governmentIdIndex('org-1', GovernmentIdType.AADHAAR, '987654321012'),
    ).toThrow(/not configured/i);
  });

  it('compares digests without short-circuiting', () => {
    const svc = hashes(PEPPER);
    const { blindIndex } = svc.governmentIdIndex(
      'org-1',
      GovernmentIdType.AADHAAR,
      '987654321012',
    );
    expect(svc.matches(blindIndex, blindIndex)).toBe(true);
    expect(svc.matches(blindIndex, 'f'.repeat(64))).toBe(false);
    expect(svc.matches(blindIndex, 'ff')).toBe(false);
  });
});

describe('Masking', () => {
  it('shows only the last four digits of an identifier', () => {
    expect(maskAadhaar(lastFour('987654321012'))).toBe('XXXX XXXX 1012');
    expect(maskAadhaar(null)).toBeNull();
  });

  it('masks contact numbers and email addresses', () => {
    expect(maskPhone('+91 98765 43210')).toBe('********3210');
    expect(maskEmail('asha.verma@example.edu')).toBe('a*********@example.edu');
  });

  it('reveals nothing at all for key material, not even its length', () => {
    expect(redact()).toBe('[REDACTED]');
  });
});
