/**
 * Key custody, expressed as two abstractions the application depends on and
 * neither of which it satisfies by itself.
 *
 * The point of splitting them is that they have different threat models. The
 * operational key is on the server by necessity — every request needs it. The
 * recovery key must survive the server being compromised, so the server may
 * hold at most the half that cannot decrypt.
 *
 * See docs/core/key-custody.md for what remains an operational decision.
 */

/** A wrapped data-encryption key and the KEK generation that produced it. */
export interface WrappedKey {
  wrapped: Buffer;
  kekVersion: number;
}

/**
 * The symmetric key-encryption key the server uses on every request.
 *
 * Sourced from `ENCRYPTION_KEY` today. The interface exists so a future KMS,
 * Vault or HSM integration replaces this provider without touching a single
 * caller — `OrganizationDataKey` already records which version produced each
 * wrap, so the two can coexist during a rotation.
 */
export abstract class OperationalKeyProvider {
  /** Wrap a DEK for day-to-day storage. */
  abstract wrap(dek: Buffer): Promise<WrappedKey>;

  /** Unwrap a DEK produced by the named KEK generation. */
  abstract unwrap(wrapped: Buffer, kekVersion: number): Promise<Buffer>;

  /** The generation new wraps are produced with. */
  abstract currentVersion(): number;
}

/**
 * The break-glass path.
 *
 * Deliberately encrypt-only from the application's side. A provider hands over
 * the *public* half of a recovery keypair; the private half lives offline and
 * the server never sees it, so recovering a DEK is an offline ceremony rather
 * than an API call.
 *
 * That asymmetry is the entire security property. A symmetric recovery key held
 * next to the operational one would mean two copies of the same failure: a
 * server compromise would yield both, and the recovery path would be worth
 * nothing precisely when it is needed.
 */
export abstract class RecoveryKeyProvider {
  /**
   * Whether recovery custody is established for this deployment.
   *
   * False means the recovery public key is not configured. Callers must treat
   * that as a real gap and not as "recovery will be fine" — production refuses
   * to provision a data key at all in that state.
   */
  abstract isConfigured(): boolean;

  /**
   * Wrap a DEK with the recovery public key.
   *
   * Throws when custody is not established. It never invents a key, never
   * derives one from the operational key, and never returns a placeholder —
   * a wrap nobody can unwrap is worse than an absent one, because it looks
   * like protection.
   */
  abstract wrap(dek: Buffer): Promise<WrappedKey>;

  /**
   * Unwrapping is **not** implemented, and not implementable here.
   *
   * It requires the offline private half. The recovery runbook describes the
   * ceremony; the application deliberately has no code path that could perform
   * it, because a code path that could would defeat the reason for having it.
   */
  abstract describeRecoveryProcedure(): string;
}
