import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  DocumentOwnerType,
  DocumentScanStatus,
  DocumentStatus,
  DocumentVerificationStatus,
  Prisma,
} from '@/generated/client';
import { DocumentService } from '@/modules/documents/document.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { UploadedFile } from '@/modules/documents/uploaded-file';
import { ResourceScope } from '@/common/scope/resource-scope';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};
const ACTOR = { userId: 'user-1', role: 'BRANCH_ADMIN' };

const PDF_BYTES = Buffer.from('%PDF-1.4 fake certificate content');

const pdfFile = (over: Partial<UploadedFile> = {}): UploadedFile => ({
  originalname: 'cert.pdf',
  mimetype: 'application/pdf',
  size: PDF_BYTES.length,
  buffer: PDF_BYTES,
  ...over,
});

const documentType = (over: Record<string, unknown> = {}) => ({
  id: 'dt-1',
  code: 'BIRTH_CERTIFICATE',
  isActive: true,
  isSensitive: false,
  hasExpiry: false,
  defaultValidityMonths: null,
  allowedMimeTypes: ['application/pdf'],
  maxSizeBytes: 10_485_760,
  ...over,
});

function p2002(target: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [target] },
  });
}

describe('DocumentService', () => {
  let mockPrisma: any;
  let mockOutbox: { enqueue: jest.Mock };
  let mockEventBus: { publish: jest.Mock };
  let mockCrypto: { encryptBuffer: jest.Mock; decryptBuffer: jest.Mock };
  let mockStorage: {
    providerName: string;
    upload: jest.Mock;
    download: jest.Mock;
  };
  let mockScan: { scan: jest.Mock };
  let mockOwners: { resolve: jest.Mock };
  let mockDocumentTypes: { findOne: jest.Mock };
  let service: DocumentService;

  beforeEach(() => {
    mockPrisma = {
      document: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      documentVersion: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { versionNumber: null } }),
        create: jest.fn(),
        update: jest.fn(),
      },
      documentType: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };
    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockCrypto = {
      encryptBuffer: jest
        .fn()
        .mockResolvedValue({
          ciphertext: Buffer.from('cipher'),
          keyVersion: 1,
        }),
      decryptBuffer: jest.fn().mockResolvedValue(PDF_BYTES),
    };
    mockStorage = {
      providerName: 'local',
      upload: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue(Buffer.from('cipher')),
    };
    mockScan = {
      scan: jest.fn().mockResolvedValue({ status: DocumentScanStatus.CLEAN }),
    };
    mockOwners = {
      resolve: jest
        .fn()
        .mockResolvedValue({ organizationId: 'org-1', branchId: 'branch-1' }),
    };
    mockDocumentTypes = {
      findOne: jest.fn().mockResolvedValue(documentType()),
    };

    service = new DocumentService(
      mockPrisma as PrismaService,
      mockOutbox as any,
      mockEventBus as any,
      mockCrypto as any,
      mockStorage as any,
      mockScan as any,
      mockOwners as any,
      mockDocumentTypes as any,
    );
  });

  describe('upload', () => {
    const dto = {
      ownerType: DocumentOwnerType.APPLICANT,
      ownerId: 'app-1',
      documentTypeId: 'dt-1',
    };

    it('creates a new Document and a v1 DocumentVersion that becomes current', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null); // no existing ACTIVE document
      mockPrisma.document.create.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: null,
      });
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'v-1',
        scanStatus: DocumentScanStatus.CLEAN,
        uploadedAt: new Date(),
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      const result = await service.upload(dto, pdfFile(), SCOPE, ACTOR);

      expect(result.becameCurrent).toBe(true);
      expect(mockScan.scan).toHaveBeenCalledWith(PDF_BYTES);
      expect(mockCrypto.encryptBuffer).toHaveBeenCalledWith('org-1', PDF_BYTES);
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('org-1/BIRTH_CERTIFICATE/'),
        Buffer.from('cipher'),
        'application/octet-stream',
      );
      expect(mockPrisma.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 1,
            documentId: 'doc-1',
          }),
        }),
      );
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { currentVersionId: 'v-1', expiresAt: null },
      });
      expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
    });

    it('adds a new version to an existing ACTIVE document instead of creating a second one', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: 'v-1',
      });
      mockPrisma.documentVersion.findUnique.mockResolvedValue({
        id: 'v-1',
        checksumSha256: 'different-checksum',
      });
      mockPrisma.documentVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: 1 },
      });
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'v-2',
        scanStatus: DocumentScanStatus.CLEAN,
        uploadedAt: new Date(),
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      const result = await service.upload(dto, pdfFile(), SCOPE, ACTOR);

      expect(mockPrisma.document.create).not.toHaveBeenCalled();
      expect(mockPrisma.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 2 }),
        }),
      );
      expect(mockPrisma.documentVersion.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { supersededAt: expect.any(Date) },
      });
      expect(result.becameCurrent).toBe(true);
    });

    it('refuses a re-upload identical to the current version', async () => {
      const checksum = createHash('sha256').update(PDF_BYTES).digest('hex');
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: 'v-1',
      });
      mockPrisma.documentVersion.findUnique.mockResolvedValue({
        id: 'v-1',
        checksumSha256: checksum,
      });

      await expect(
        service.upload(dto, pdfFile(), SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'DOCUMENT_UNCHANGED' },
      });
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('never sets currentVersionId when the scan is not CLEAN, and refuses the request', async () => {
      mockScan.scan.mockResolvedValue({
        status: DocumentScanStatus.INFECTED,
        details: 'EICAR-Test',
      });
      mockPrisma.document.findFirst.mockResolvedValue(null);
      mockPrisma.document.create.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: null,
      });
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'v-1',
        scanStatus: DocumentScanStatus.INFECTED,
        uploadedAt: new Date(),
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      await expect(
        service.upload(dto, pdfFile(), SCOPE, ACTOR),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.document.update).not.toHaveBeenCalled();
      // Uploaded + scan-failed events both enqueued for the same version.
      expect(mockOutbox.enqueue).toHaveBeenCalledTimes(2);
    });

    it("rejects a MIME type outside the document type's allow-list", async () => {
      await expect(
        service.upload(
          dto,
          pdfFile({ mimetype: 'application/zip' }),
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'MIME_TYPE_NOT_ALLOWED' } });
      expect(mockOwners.resolve).not.toHaveBeenCalled();
    });

    it("rejects a file over the type's size limit", async () => {
      mockDocumentTypes.findOne.mockResolvedValue(
        documentType({ maxSizeBytes: 10 }),
      );
      await expect(
        service.upload(dto, pdfFile(), SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'FILE_TOO_LARGE' },
      });
    });

    it('rejects content whose magic bytes do not match the declared MIME type', async () => {
      await expect(
        service.upload(
          dto,
          pdfFile({ buffer: Buffer.from('not actually a pdf') }),
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'MIME_TYPE_MISMATCH' } });
    });

    it('refuses to upload against an inactive document type', async () => {
      mockDocumentTypes.findOne.mockResolvedValue(
        documentType({ isActive: false }),
      );
      await expect(
        service.upload(dto, pdfFile(), SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'DOCUMENT_TYPE_INACTIVE' },
      });
    });

    it('translates a concurrent-replace unique violation into a 409 asking for retry', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: null,
      });
      mockPrisma.documentVersion.create.mockRejectedValue(
        p2002('DocumentVersion_documentId_versionNumber_key'),
      );

      await expect(
        service.upload(dto, pdfFile(), SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'CONCURRENT_REPLACE' },
      });
    });

    it("sets expiresAt from the document type's validity period when it has one", async () => {
      mockDocumentTypes.findOne.mockResolvedValue(
        documentType({ hasExpiry: true, defaultValidityMonths: 12 }),
      );
      mockPrisma.document.findFirst.mockResolvedValue(null);
      mockPrisma.document.create.mockResolvedValue({
        id: 'doc-1',
        currentVersionId: null,
      });
      const uploadedAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'v-1',
        scanStatus: DocumentScanStatus.CLEAN,
        uploadedAt,
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      await service.upload(dto, pdfFile(), SCOPE, ACTOR);

      const call = mockPrisma.document.update.mock.calls[0][0];
      expect(call.data.expiresAt.getUTCFullYear()).toBe(2027);
    });
  });

  describe('verify / reject', () => {
    it('verifies the current version', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        currentVersionId: 'v-1',
      });
      mockPrisma.documentVersion.findUniqueOrThrow.mockResolvedValue({
        id: 'v-1',
        scanStatus: DocumentScanStatus.CLEAN,
      });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      await service.verify('doc-1', SCOPE, ACTOR);

      expect(mockPrisma.documentVersion.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: expect.objectContaining({
          verificationStatus: DocumentVerificationStatus.VERIFIED,
          rejectionReason: null,
        }),
      });
      expect(mockOutbox.enqueue).toHaveBeenCalledTimes(1);
    });

    it('refuses to verify a document with no current version', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        currentVersionId: null,
      });

      await expect(service.verify('doc-1', SCOPE, ACTOR)).rejects.toMatchObject(
        {
          response: { error: 'NO_CURRENT_VERSION' },
        },
      );
    });

    it("404s a document outside the caller's scope", async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);
      await expect(
        service.verify('doc-cross-tenant', SCOPE, ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects the current version with the supplied reason', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        currentVersionId: 'v-1',
      });
      mockPrisma.documentVersion.update.mockResolvedValue({ id: 'v-1' });
      mockPrisma.document.findUniqueOrThrow.mockResolvedValue({ id: 'doc-1' });

      await service.reject('doc-1', 'Illegible scan', SCOPE, ACTOR);

      expect(mockPrisma.documentVersion.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: expect.objectContaining({
          verificationStatus: DocumentVerificationStatus.REJECTED,
          rejectionReason: 'Illegible scan',
        }),
      });
    });
  });

  describe('archive', () => {
    it('archives an active document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        status: DocumentStatus.ACTIVE,
      });
      mockPrisma.document.update.mockResolvedValue({
        id: 'doc-1',
        status: DocumentStatus.ARCHIVED,
      });

      await service.archive('doc-1', 'No longer needed', SCOPE, ACTOR);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          status: DocumentStatus.ARCHIVED,
          archivedBy: 'user-1',
          archiveReason: 'No longer needed',
        }),
      });
    });

    it('refuses to archive an already-archived document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        status: DocumentStatus.ARCHIVED,
      });

      await expect(
        service.archive('doc-1', undefined, SCOPE, ACTOR),
      ).rejects.toMatchObject({
        response: { error: 'ALREADY_ARCHIVED' },
      });
    });
  });

  describe('download', () => {
    const baseDoc = {
      id: 'doc-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      documentTypeId: 'dt-1',
      currentVersionId: 'v-1',
    };
    const cleanVersion = {
      id: 'v-1',
      documentId: 'doc-1',
      scanStatus: DocumentScanStatus.CLEAN,
      storageKey: 'org-1/BIRTH_CERTIFICATE/abc',
      encryptionKeyVersion: 1,
      mimeType: 'application/pdf',
      originalFilename: 'cert.pdf',
    };

    it('decrypts and returns a clean version, and audits the access', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
      mockPrisma.documentVersion.findFirst = jest
        .fn()
        .mockResolvedValue(cleanVersion);
      mockPrisma.documentType.findUniqueOrThrow.mockResolvedValue(
        documentType(),
      );

      const result = await service.download('doc-1', SCOPE, ACTOR);

      expect(result.buffer).toEqual(PDF_BYTES);
      expect(mockCrypto.decryptBuffer).toHaveBeenCalledWith(
        'org-1',
        Buffer.from('cipher'),
        1,
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('never serves a version that is not CLEAN, regardless of permission', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
      mockPrisma.documentVersion.findFirst = jest
        .fn()
        .mockResolvedValue({
          ...cleanVersion,
          scanStatus: DocumentScanStatus.INFECTED,
        });

      await expect(service.download('doc-1', SCOPE, ACTOR)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockStorage.download).not.toHaveBeenCalled();
    });

    it('refuses a STAFF caller downloading a sensitive document type', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
      mockPrisma.documentVersion.findFirst = jest
        .fn()
        .mockResolvedValue(cleanVersion);
      mockPrisma.documentType.findUniqueOrThrow.mockResolvedValue(
        documentType({ isSensitive: true }),
      );

      await expect(
        service.download('doc-1', SCOPE, { userId: 'u-1', role: 'STAFF' }),
      ).rejects.toMatchObject({
        response: { error: 'SENSITIVE_DOCUMENT_RESTRICTED' },
      });
    });

    it('allows a BRANCH_ADMIN to download a sensitive document type', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(baseDoc);
      mockPrisma.documentVersion.findFirst = jest
        .fn()
        .mockResolvedValue(cleanVersion);
      mockPrisma.documentType.findUniqueOrThrow.mockResolvedValue(
        documentType({ isSensitive: true }),
      );

      await expect(
        service.download('doc-1', SCOPE, {
          userId: 'u-1',
          role: 'BRANCH_ADMIN',
        }),
      ).resolves.toBeDefined();
    });
  });
});
