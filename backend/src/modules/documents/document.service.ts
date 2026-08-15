import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import {
  Document,
  DocumentOwnerType,
  DocumentScanStatus,
  DocumentStatus,
  DocumentType,
  DocumentVerificationStatus,
  Prisma,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { IdentityCryptoService } from '@/infrastructure/crypto/identity-crypto.service';
import { StoragePort } from '@/infrastructure/storage/storage-port';
import { ScanPort } from '@/infrastructure/scan/scan-port';
import { ResourceScope } from '@/common/scope/resource-scope';
import { UserRole } from '@/common/enums/role.enum';
import {
  DocumentArchivedEvent,
  DocumentDownloadedEvent,
  DocumentRejectedEvent,
  DocumentScanFailedEvent,
  DocumentUploadedEvent,
  DocumentVerifiedEvent,
} from '@/common/events';
import { OwnerResolverService } from './owner-resolver.service';
import { DocumentTypeService } from './document-type.service';
import { matchesDeclaredMimeType } from './mime-sniff';
import { UploadedFile } from './uploaded-file';

const UNIQUE_VIOLATION = 'P2002';

/**
 * Actor as this service needs it — not the full request context, so a test
 * or a system caller (a future retention sweep) can supply one without a
 * request in scope.
 */
export interface DocumentActor {
  userId: string | null;
  role: string | null;
}

interface PersistContext {
  existing: Document | null;
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentTypeId: string;
  organizationId: string;
  branchId: string | null;
  documentType: DocumentType;
}

/**
 * S3 — Document Management. Owns document metadata, storage references,
 * lifecycle, security and versioning. Business modules (Admissions,
 * Identity) own what a document *means*; this owns the file. See
 * docs/planning/document-management-specification.md.
 */
@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxPublisher,
    private readonly eventBus: EventBus,
    private readonly crypto: IdentityCryptoService,
    private readonly storage: StoragePort,
    private readonly scan: ScanPort,
    private readonly owners: OwnerResolverService,
    private readonly documentTypes: DocumentTypeService,
  ) {}

  /** Upload for a new or existing (owner, type) pair — a fresh upload for an
   *  owner+type that already has an ACTIVE document becomes a new version. */
  async upload(
    dto: {
      ownerType: DocumentOwnerType;
      ownerId: string;
      documentTypeId: string;
    },
    file: UploadedFile,
    scope: ResourceScope,
    actor: DocumentActor,
  ) {
    const documentType = await this.getUploadableType(
      dto.documentTypeId,
      scope,
    );
    this.validateFile(file, documentType);
    const owner = await this.owners.resolve(dto.ownerType, dto.ownerId, scope);

    const existing = await this.prisma.document.findFirst({
      where: {
        organizationId: owner.organizationId,
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        documentTypeId: dto.documentTypeId,
        status: DocumentStatus.ACTIVE,
      },
    });

    return this.persistVersion(
      {
        existing,
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        documentTypeId: dto.documentTypeId,
        organizationId: owner.organizationId,
        branchId: owner.branchId,
        documentType,
      },
      file,
      actor,
    );
  }

  /** A new version on an already-identified document — owner/type come from the row, not the caller. */
  async replace(
    documentId: string,
    file: UploadedFile,
    scope: ResourceScope,
    actor: DocumentActor,
  ) {
    const existing = await this.findOwnedDocument(documentId, scope);
    if (existing.status !== DocumentStatus.ACTIVE) {
      throw new ConflictException({
        error: 'DOCUMENT_ARCHIVED',
        message: 'Cannot replace an archived document.',
      });
    }
    const documentType = await this.getUploadableType(
      existing.documentTypeId,
      scope,
    );
    this.validateFile(file, documentType);

    return this.persistVersion(
      {
        existing,
        ownerType: existing.ownerType,
        ownerId: existing.ownerId,
        documentTypeId: existing.documentTypeId,
        organizationId: existing.organizationId,
        branchId: existing.branchId,
        documentType,
      },
      file,
      actor,
    );
  }

  async verify(documentId: string, scope: ResourceScope, actor: DocumentActor) {
    const document = await this.findOwnedDocument(documentId, scope);
    if (!document.currentVersionId) {
      throw new ConflictException({
        error: 'NO_CURRENT_VERSION',
        message: 'This document has no current version to verify.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.findUniqueOrThrow({
        where: { id: document.currentVersionId! },
      });

      // Structurally unreachable — only a CLEAN version ever becomes
      // current — kept as an explicit assertion rather than a silent trust.
      if (version.scanStatus !== DocumentScanStatus.CLEAN) {
        throw new ConflictException({
          error: 'VERSION_NOT_CLEAN',
          message: 'Only a clean, scanned version can be verified.',
        });
      }

      await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          verificationStatus: DocumentVerificationStatus.VERIFIED,
          verifiedBy: actor.userId,
          verifiedAt: new Date(),
          rejectionReason: null,
        },
      });

      await this.outbox.enqueue(
        new DocumentVerifiedEvent({
          documentId: document.id,
          documentVersionId: version.id,
          organizationId: document.organizationId,
          verifiedBy: actor.userId ?? 'SYSTEM',
        }),
        tx,
      );

      return tx.document.findUniqueOrThrow({
        where: { id: document.id },
        include: { currentVersion: true },
      });
    });
  }

  async reject(
    documentId: string,
    reason: string,
    scope: ResourceScope,
    actor: DocumentActor,
  ) {
    const document = await this.findOwnedDocument(documentId, scope);
    if (!document.currentVersionId) {
      throw new ConflictException({
        error: 'NO_CURRENT_VERSION',
        message: 'This document has no current version to reject.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.update({
        where: { id: document.currentVersionId! },
        data: {
          verificationStatus: DocumentVerificationStatus.REJECTED,
          verifiedBy: actor.userId,
          verifiedAt: new Date(),
          rejectionReason: reason,
        },
      });

      await this.outbox.enqueue(
        new DocumentRejectedEvent({
          documentId: document.id,
          documentVersionId: version.id,
          organizationId: document.organizationId,
          rejectedBy: actor.userId ?? 'SYSTEM',
        }),
        tx,
      );

      return tx.document.findUniqueOrThrow({
        where: { id: document.id },
        include: { currentVersion: true },
      });
    });
  }

  /** Archived, never deleted — a document referenced by an approved admission must not disappear (§19). */
  async archive(
    documentId: string,
    reason: string | undefined,
    scope: ResourceScope,
    actor: DocumentActor,
  ) {
    const document = await this.findOwnedDocument(documentId, scope);
    if (document.status === DocumentStatus.ARCHIVED) {
      throw new ConflictException({
        error: 'ALREADY_ARCHIVED',
        message: 'This document is already archived.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedBy: actor.userId ?? 'SYSTEM',
          archiveReason: reason ?? null,
        },
      });

      await this.outbox.enqueue(
        new DocumentArchivedEvent({
          documentId,
          organizationId: document.organizationId,
          archivedBy: actor.userId ?? 'SYSTEM',
        }),
        tx,
      );

      return updated;
    });
  }

  async findOne(documentId: string, scope: ResourceScope) {
    const document = await this.findOwnedDocument(documentId, scope);
    return this.prisma.document.findUniqueOrThrow({
      where: { id: document.id },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'desc' } },
        documentType: true,
      },
    });
  }

  async findForOwner(
    ownerType: DocumentOwnerType,
    ownerId: string,
    scope: ResourceScope,
  ) {
    return this.prisma.document.findMany({
      where: {
        organizationId: scope.organizationId,
        ownerType,
        ownerId,
        OR: [{ branchId: null }, { branchId: scope.branchId }],
      },
      include: { currentVersion: true, documentType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Decrypted bytes of a document's current (or a named) version.
   *
   * A version that is not `CLEAN` is never returned, regardless of caller
   * permission — an infected or unscanned file is never served (§11.5). A
   * sensitive document type additionally refuses `STAFF`; every download is
   * an auditable action (§16), published directly since it commits no data
   * of its own to attach the event to.
   */
  async download(
    documentId: string,
    scope: ResourceScope,
    actor: DocumentActor,
    versionId?: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const document = await this.findOwnedDocument(documentId, scope);
    const targetVersionId = versionId ?? document.currentVersionId;
    if (!targetVersionId) {
      throw new NotFoundException('This document has no downloadable version.');
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: { id: targetVersionId, documentId: document.id },
    });
    if (!version) throw new NotFoundException('Document version not found');

    if (version.scanStatus !== DocumentScanStatus.CLEAN) {
      throw new ForbiddenException({
        error: 'VERSION_NOT_CLEAN',
        message:
          'This version has not passed virus scanning and cannot be downloaded.',
      });
    }

    const documentType = await this.prisma.documentType.findUniqueOrThrow({
      where: { id: document.documentTypeId },
    });
    if (documentType.isSensitive && actor.role === UserRole.STAFF) {
      throw new ForbiddenException({
        error: 'SENSITIVE_DOCUMENT_RESTRICTED',
        message:
          'This document type requires branch-admin level access or higher.',
      });
    }

    const ciphertext = await this.storage.download(version.storageKey);
    const plaintext = await this.crypto.decryptBuffer(
      document.organizationId,
      ciphertext,
      version.encryptionKeyVersion,
    );

    await this.eventBus.publish(
      new DocumentDownloadedEvent({
        documentId: document.id,
        documentVersionId: version.id,
        organizationId: document.organizationId,
        downloadedBy: actor.userId ?? 'SYSTEM',
      }),
    );

    return {
      buffer: plaintext,
      mimeType: version.mimeType,
      filename: version.originalFilename,
    };
  }

  // ---------------------------------------------------------------------

  private async getUploadableType(
    documentTypeId: string,
    scope: ResourceScope,
  ): Promise<DocumentType> {
    const documentType = await this.documentTypes.findOne(
      documentTypeId,
      scope,
    );
    if (!documentType.isActive) {
      throw new ConflictException({
        error: 'DOCUMENT_TYPE_INACTIVE',
        message: 'This document type is no longer accepted.',
      });
    }
    return documentType;
  }

  private validateFile(file: UploadedFile, documentType: DocumentType): void {
    if (!documentType.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        error: 'MIME_TYPE_NOT_ALLOWED',
        message: `${file.mimetype} is not accepted for this document type.`,
        allowed: documentType.allowedMimeTypes,
      });
    }
    if (file.size > documentType.maxSizeBytes) {
      throw new BadRequestException({
        error: 'FILE_TOO_LARGE',
        message: `File exceeds the ${documentType.maxSizeBytes}-byte limit for this document type.`,
      });
    }
    if (!matchesDeclaredMimeType(file.mimetype, file.buffer)) {
      throw new BadRequestException({
        error: 'MIME_TYPE_MISMATCH',
        message: 'The file content does not match its declared type.',
      });
    }
  }

  /** Scoped to both branch-fixed and organization-scoped owner types — see `document.prisma`. */
  private async findOwnedDocument(
    documentId: string,
    scope: ResourceScope,
  ): Promise<Document> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: scope.organizationId,
        OR: [{ branchId: null }, { branchId: scope.branchId }],
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  /**
   * The shared core of upload and replace. Storage I/O happens *before* the
   * transaction opens: a rollback after a successful upload leaves an
   * orphaned encrypted blob (an accepted, documented gap of the same class
   * as a burned numbering sequence value); a `DocumentVersion` row pointing
   * at a blob that was never durably written is not acceptable, so storage
   * always happens first.
   */
  private async persistVersion(
    ctx: PersistContext,
    file: UploadedFile,
    actor: DocumentActor,
  ) {
    const scanResult = await this.scan.scan(file.buffer);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    if (ctx.existing?.currentVersionId) {
      const current = await this.prisma.documentVersion.findUnique({
        where: { id: ctx.existing.currentVersionId },
      });
      if (current && current.checksumSha256 === checksum) {
        throw new ConflictException({
          error: 'DOCUMENT_UNCHANGED',
          message: 'This file is identical to the current version.',
        });
      }
    }

    const encrypted = await this.crypto.encryptBuffer(
      ctx.organizationId,
      file.buffer,
    );
    const storageKey = `${ctx.organizationId}/${ctx.documentType.code}/${uuidv7()}`;
    await this.storage.upload(
      storageKey,
      encrypted.ciphertext,
      'application/octet-stream',
    );

    let result: {
      document: Document;
      version: { id: string; scanStatus: DocumentScanStatus };
      becameCurrent: boolean;
    };
    try {
      result = await this.prisma.$transaction((tx) =>
        this.writeVersionRow(
          tx,
          ctx,
          file,
          checksum,
          storageKey,
          encrypted.keyVersion,
          scanResult,
          actor,
        ),
      );
    } catch (error) {
      if (this.isVersionRace(error)) {
        throw new ConflictException({
          error: 'CONCURRENT_REPLACE',
          message:
            'Another replacement for this document happened concurrently. Retry the request.',
        });
      }
      throw error;
    }

    if (!result.becameCurrent) {
      throw new UnprocessableEntityException({
        error: 'DOCUMENT_SCAN_FAILED',
        message:
          'The uploaded file failed virus scanning and has not been accepted as the current version.',
        scanStatus: result.version.scanStatus,
        documentId: result.document.id,
        documentVersionId: result.version.id,
      });
    }

    return result;
  }

  private async writeVersionRow(
    tx: PrismaTransactionClient,
    ctx: PersistContext,
    file: UploadedFile,
    checksum: string,
    storageKey: string,
    encryptionKeyVersion: number,
    scanResult: { status: DocumentScanStatus; details?: string },
    actor: DocumentActor,
  ) {
    let document = ctx.existing;
    if (!document) {
      try {
        document = await tx.document.create({
          data: {
            organizationId: ctx.organizationId,
            branchId: ctx.branchId,
            ownerType: ctx.ownerType,
            ownerId: ctx.ownerId,
            documentTypeId: ctx.documentTypeId,
            createdBy: actor.userId,
          },
        });
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        // Lost the race to create the ACTIVE document for this owner+type —
        // the winner's row is what this upload becomes a version of.
        const winner = await tx.document.findFirst({
          where: {
            organizationId: ctx.organizationId,
            ownerType: ctx.ownerType,
            ownerId: ctx.ownerId,
            documentTypeId: ctx.documentTypeId,
            status: DocumentStatus.ACTIVE,
          },
        });
        if (!winner) throw error;
        document = winner;
      }
    }

    const maxVersion = await tx.documentVersion.aggregate({
      where: { documentId: document.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

    if (document.currentVersionId) {
      await tx.documentVersion.update({
        where: { id: document.currentVersionId },
        data: { supersededAt: new Date() },
      });
    }

    const version = await tx.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber,
        storageProvider: this.storage.providerName,
        storageKey,
        originalFilename: this.sanitizeFilename(file.originalname),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksumSha256: checksum,
        encryptionKeyVersion,
        scanStatus: scanResult.status,
        scanCompletedAt: new Date(),
        scanDetails: scanResult.details ?? null,
        uploadedBy: actor.userId,
      },
    });

    const becameCurrent = scanResult.status === DocumentScanStatus.CLEAN;
    if (becameCurrent) {
      const expiresAt =
        ctx.documentType.hasExpiry && ctx.documentType.defaultValidityMonths
          ? this.addMonths(
              version.uploadedAt,
              ctx.documentType.defaultValidityMonths,
            )
          : null;
      await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id, expiresAt },
      });
    }

    await this.outbox.enqueue(
      new DocumentUploadedEvent({
        documentId: document.id,
        documentVersionId: version.id,
        organizationId: ctx.organizationId,
        ownerType: ctx.ownerType,
        ownerId: ctx.ownerId,
        documentTypeId: ctx.documentTypeId,
        versionNumber,
        becameCurrent,
      }),
      tx,
    );

    if (!becameCurrent) {
      await this.outbox.enqueue(
        new DocumentScanFailedEvent({
          documentId: document.id,
          documentVersionId: version.id,
          organizationId: ctx.organizationId,
          scanStatus: scanResult.status,
        }),
        tx,
      );
    }

    return {
      document: await tx.document.findUniqueOrThrow({
        where: { id: document.id },
      }),
      version,
      becameCurrent,
    };
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /** Display only — never used to derive `storageKey`, which rules out path traversal. */
  private sanitizeFilename(name: string): string {
    const cleaned = name.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 255);
    return cleaned || 'file';
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    );
  }

  private isVersionRace(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== UNIQUE_VIOLATION
    ) {
      return false;
    }
    const target = String(
      (error.meta as { target?: string | string[] } | undefined)?.target ?? '',
    );
    return target.includes('documentId_versionNumber');
  }
}
