import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentScanStatus } from '@/generated/client';
import { ScanPort, ScanResult } from './scan-port';

/**
 * The development scan provider — performs no scan at all.
 *
 * §11.4/§11.5 are explicit: virus scanning is mandatory and blocking on
 * ingest, and an unscanned version must never be treated as clean. This
 * repository has no ClamAV or cloud scanning API available to it, so rather
 * than fabricate a scanner that always says "clean" — which is exactly the
 * `DOCUMENT_CHECKLIST_SATISFIED` no-op mistake this phase exists to not
 * repeat — this adapter marks every version `CLEAN` **only outside
 * production**, loudly, once, at boot, mirroring `EnvRecoveryKeyProvider`'s
 * production-refusal pattern for exactly the same reason: a security
 * dependency that is not configured must fail loudly outside production and
 * fail closed inside it.
 *
 * A production deployment with no real `ScanPort` bound refuses to start
 * scanning at all — every upload is refused with `SCAN_NOT_CONFIGURED`
 * rather than silently passed through unscanned.
 */
@Injectable()
export class NullScanAdapter extends ScanPort implements OnModuleInit {
  readonly providerName = 'null-dev';
  private readonly logger = new Logger(NullScanAdapter.name);
  private isProduction = false;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (!this.isProduction) {
      this.logger.warn(
        'Document scan provider is "null-dev" — uploads are marked CLEAN without ' +
          'being scanned. This is permitted outside production only. See ' +
          'docs/planning/document-management-specification.md §11.7 DQ1.',
      );
    }
  }

  async scan(): Promise<ScanResult> {
    if (this.isProduction) {
      throw new InternalServerErrorException({
        error: 'SCAN_NOT_CONFIGURED',
        message:
          'No virus scanning provider is configured for this deployment. Refusing to ' +
          'accept an upload unscanned in production. See docs/core/key-custody.md for ' +
          'the equivalent pattern applied to encryption, and DQ1 in the document spec.',
      });
    }
    return Promise.resolve({ status: DocumentScanStatus.CLEAN });
  }
}
