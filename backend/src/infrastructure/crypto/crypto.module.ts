import { Global, Module } from '@nestjs/common';
import {
  OperationalKeyProvider,
  RecoveryKeyProvider,
} from './key-provider.interface';
import {
  EnvOperationalKeyProvider,
  EnvRecoveryKeyProvider,
} from './env-key.provider';
import { IdentityCryptoService } from './identity-crypto.service';
import { IdentityHashService } from './identity-hash.service';

/**
 * The only place encryption is configured.
 *
 * Bound to the abstract providers rather than the concrete classes, so
 * replacing `ENCRYPTION_KEY` with a KMS or an HSM is a change to this module
 * and nothing else. `OrganizationDataKey` already records which KEK version
 * produced each wrap, so the two can coexist through a rotation.
 */
@Global()
@Module({
  providers: [
    { provide: OperationalKeyProvider, useClass: EnvOperationalKeyProvider },
    { provide: RecoveryKeyProvider, useClass: EnvRecoveryKeyProvider },
    IdentityCryptoService,
    IdentityHashService,
  ],
  exports: [
    OperationalKeyProvider,
    RecoveryKeyProvider,
    IdentityCryptoService,
    IdentityHashService,
  ],
})
export class CryptoModule {}
