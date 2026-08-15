import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentOwnerType } from '@/generated/client';
import { DocumentService } from './document.service';
import {
  ArchiveDocumentDto,
  RejectDocumentDto,
  UploadDocumentDto,
} from './dto/document.dto';
import { DocumentDto } from './dto/document-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';
import { UploadedFile as UploadedFileShape } from './uploaded-file';

/** Defence in depth ahead of `DocumentType.maxSizeBytes` — protects against a memory-exhausting upload before any per-type policy runs. */
const GLOBAL_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.BRANCH_ADMIN,
  UserRole.STAFF,
] as const;

const REVIEWER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.BRANCH_ADMIN,
] as const;

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: GLOBAL_MAX_UPLOAD_BYTES } }),
  )
  @Roles(...STAFF_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Upload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document',
    description:
      'A fresh upload for an owner+type that already has an ACTIVE document becomes a new ' +
      'version of it, not a second document. Staff-only in v1 (§11.7 DQ3) — there is no ' +
      'route for a parent to upload directly.',
  })
  @ApiCreatedEnvelope(DocumentDto, {
    message: 'Document uploaded successfully',
  })
  @ApiStandardErrors(400, 404, 409, 422)
  async upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: UploadedFileShape,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: 'FILE_REQUIRED',
        message: 'No file was provided.',
      });
    }
    const scope = resourceScopeOf(req.context);
    const result = await this.documents.upload(dto, file, scope, {
      userId: req.userId ?? null,
      role: req.context?.role ?? null,
    });
    return { data: result.document, message: 'Document uploaded successfully' };
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: "List an owner's documents" })
  @ApiOkEnvelope(DocumentDto, { isArray: true })
  async findForOwner(
    @Query('ownerType') ownerType: DocumentOwnerType,
    @Query('ownerId') ownerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!ownerType || !ownerId) {
      throw new BadRequestException({
        error: 'OWNER_REQUIRED',
        message: 'ownerType and ownerId query parameters are required.',
      });
    }
    const scope = resourceScopeOf(req.context);
    const data = await this.documents.findForOwner(ownerType, ownerId, scope);
    return { data, message: 'Documents retrieved successfully' };
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: 'Get one document with its version history' })
  @ApiOkEnvelope(DocumentDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const scope = resourceScopeOf(req.context);
    const data = await this.documents.findOne(id, scope);
    return { data, message: 'Document retrieved successfully' };
  }

  @Post(':id/replace')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: GLOBAL_MAX_UPLOAD_BYTES } }),
  )
  @Roles(...STAFF_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Replace)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Replace a document with a new version',
    description:
      'Append-only — the previous version is never overwritten. Re-verification is always required.',
  })
  @ApiCreatedEnvelope(DocumentDto, {
    message: 'Document replaced successfully',
  })
  @ApiStandardErrors(400, 404, 409, 422)
  async replace(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileShape,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: 'FILE_REQUIRED',
        message: 'No file was provided.',
      });
    }
    const scope = resourceScopeOf(req.context);
    const result = await this.documents.replace(id, file, scope, {
      userId: req.userId ?? null,
      role: req.context?.role ?? null,
    });
    return { data: result.document, message: 'Document replaced successfully' };
  }

  @Post(':id/verify')
  @Roles(...REVIEWER_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Verify)
  @ApiOperation({ summary: "Verify a document's current version" })
  @ApiOkEnvelope(DocumentDto, { message: 'Document verified successfully' })
  @ApiStandardErrors(404, 409)
  async verify(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const scope = resourceScopeOf(req.context);
    const data = await this.documents.verify(id, scope, {
      userId: req.userId ?? null,
      role: req.context?.role ?? null,
    });
    return { data, message: 'Document verified successfully' };
  }

  @Post(':id/reject')
  @Roles(...REVIEWER_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Reject)
  @ApiOperation({ summary: "Reject a document's current version" })
  @ApiOkEnvelope(DocumentDto, { message: 'Document rejected successfully' })
  @ApiStandardErrors(404, 409)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.documents.reject(id, dto.reason, scope, {
      userId: req.userId ?? null,
      role: req.context?.role ?? null,
    });
    return { data, message: 'Document rejected successfully' };
  }

  @Post(':id/archive')
  @Roles(...REVIEWER_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Archive)
  @ApiOperation({
    summary: 'Archive a document',
    description:
      'Soft state only — never deletes the row or the stored file. See §19.',
  })
  @ApiOkEnvelope(DocumentDto, { message: 'Document archived successfully' })
  @ApiStandardErrors(404, 409)
  async archive(
    @Param('id') id: string,
    @Body() dto: ArchiveDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.documents.archive(id, dto.reason, scope, {
      userId: req.userId ?? null,
      role: req.context?.role ?? null,
    });
    return { data, message: 'Document archived successfully' };
  }

  @Get(':id/download')
  @Roles(...STAFF_ROLES)
  @RequirePermission(PERMISSIONS.Documents.Download)
  @ApiOperation({
    summary: 'Download a document version',
    description:
      'Streams decrypted bytes through the backend — never a public or presigned URL. ' +
      'A version that is not CLEAN is never served, regardless of permission. Every ' +
      'download is audited.',
  })
  @ApiStandardErrors(403, 404)
  async download(
    @Param('id') id: string,
    @Query('versionId') versionId: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const scope = resourceScopeOf(req.context);
    const result = await this.documents.download(
      id,
      scope,
      { userId: req.userId ?? null, role: req.context?.role ?? null },
      versionId,
    );
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename.replace(/"/g, '')}"`,
    });
    return new StreamableFile(result.buffer);
  }
}
