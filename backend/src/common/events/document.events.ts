import { DomainEvent } from './domain-event.base';

/**
 * Document events.
 *
 * Never carry a filename, a storage key, a checksum's source content, a
 * signed URL or the file itself — an event is copied into the outbox, the
 * audit log and every consumer's own storage. What travels is which
 * document, which owner, which type, and what happened; never anything that
 * would let a reader reconstruct or fetch the file from the event alone.
 */

export interface DocumentUploadedPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  ownerType: string;
  ownerId: string;
  documentTypeId: string;
  versionNumber: number;
  /** Whether this version became `Document.currentVersionId`. False means a scan failure. */
  becameCurrent: boolean;
}

export class DocumentUploadedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.uploaded';
  readonly payload: DocumentUploadedPayload;

  constructor(
    payload: DocumentUploadedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentUploadedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata,
    });
    this.payload = payload;
  }
}

export interface DocumentScanFailedPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  scanStatus: string;
}

/** Admin-alerting signal per §11.5 — an infected or unscannable upload never becomes current. */
export class DocumentScanFailedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.scan_failed';
  readonly payload: DocumentScanFailedPayload;

  constructor(
    payload: DocumentScanFailedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentScanFailedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata: { ...metadata, severity: 'critical' },
    });
    this.payload = payload;
  }
}

export interface DocumentVerifiedPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  verifiedBy: string;
}

export class DocumentVerifiedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.verified';
  readonly payload: DocumentVerifiedPayload;

  constructor(
    payload: DocumentVerifiedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentVerifiedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata,
    });
    this.payload = payload;
  }
}

export interface DocumentRejectedPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  rejectedBy: string;
}

export class DocumentRejectedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.rejected';
  readonly payload: DocumentRejectedPayload;

  constructor(
    payload: DocumentRejectedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentRejectedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata,
    });
    this.payload = payload;
  }
}

export interface DocumentArchivedPayload {
  documentId: string;
  organizationId: string;
  archivedBy: string;
}

export class DocumentArchivedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.archived';
  readonly payload: DocumentArchivedPayload;

  constructor(
    payload: DocumentArchivedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentArchivedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata,
    });
    this.payload = payload;
  }
}

export interface DocumentDownloadedPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  downloadedBy: string;
}

/** Not transactional — a download commits nothing, so this publishes directly rather than via the outbox. */
export class DocumentDownloadedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'document.downloaded';
  readonly payload: DocumentDownloadedPayload;

  constructor(
    payload: DocumentDownloadedPayload,
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: DocumentDownloadedEvent.EVENT_NAME,
      aggregateId: payload.documentId,
      aggregateType: 'Document',
      metadata,
    });
    this.payload = payload;
  }
}
