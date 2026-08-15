import { DocumentScanStatus } from '@/generated/client';

/** A scan never produces `PENDING` — that value exists only before a scan runs. */
export type ScanVerdict = Extract<
  DocumentScanStatus,
  'CLEAN' | 'INFECTED' | 'FAILED'
>;

export interface ScanResult {
  status: ScanVerdict;
  details?: string;
}

/**
 * The boundary between Document Management and whatever performs virus
 * scanning.
 *
 * §11.7 DQ1 names this `REQUIRES BUSINESS DECISION` — ClamAV sidecar vs a
 * cloud API that would send student documents to a third party — and
 * recommends ClamAV as real infrastructure this deployment does not run.
 * This abstraction is what lets that decision be made later without
 * touching `DocumentService`: scanning is mandatory and blocking on ingest
 * (§11.4), and `DocumentService` never inspects which implementation
 * produced the verdict.
 */
export abstract class ScanPort {
  abstract readonly providerName: string;
  abstract scan(data: Buffer): Promise<ScanResult>;
}
