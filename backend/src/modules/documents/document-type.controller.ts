import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentTypeService } from './document-type.service';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './dto/document-type.dto';
import { DocumentTypeDto } from './dto/document-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

@ApiTags('Documents: Document Types')
@ApiBearerAuth()
@Controller('document-types')
export class DocumentTypeController {
  constructor(private readonly service: DocumentTypeService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Create a document type' })
  @ApiCreatedEnvelope(DocumentTypeDto)
  @ApiStandardErrors(409)
  async create(
    @Body() dto: CreateDocumentTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, resourceScopeOf(req.context));
    return { data, message: 'Document type created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: 'List document types' })
  @ApiOkEnvelope(DocumentTypeDto, { isArray: true })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const data = await this.service.findAll(
      resourceScopeOf(req.context),
      includeInactive,
    );
    return { data, message: 'Document types retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: 'Get a document type' })
  @ApiOkEnvelope(DocumentTypeDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.service.findOne(id, resourceScopeOf(req.context));
    return { data, message: 'Document type retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Update a document type' })
  @ApiOkEnvelope(DocumentTypeDto)
  @ApiStandardErrors(404, 409)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTypeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(
      id,
      dto,
      resourceScopeOf(req.context),
    );
    return { data, message: 'Document type updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Soft delete a document type' })
  @ApiEmptyEnvelope()
  @ApiStandardErrors(404, 409)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, resourceScopeOf(req.context));
    return { message: 'Document type deleted successfully' };
  }
}
