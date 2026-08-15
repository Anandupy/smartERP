import { Global, Module } from '@nestjs/common';
import { ScanPort } from './scan-port';
import { NullScanAdapter } from './null-scan.adapter';

/**
 * The only place a virus-scan provider is chosen. See `NullScanAdapter` for
 * why this deployment ships one that refuses to run in production rather
 * than a real scanner it cannot honestly claim to run.
 */
@Global()
@Module({
  providers: [{ provide: ScanPort, useClass: NullScanAdapter }],
  exports: [ScanPort],
})
export class ScanModule {}
