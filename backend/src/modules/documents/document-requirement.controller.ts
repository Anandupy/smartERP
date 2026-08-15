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
import { DocumentRequirementService } from './document-requirement.service';
import {
  CreateDocumentRequirementDto,
  UpdateDocumentRequirementDto,
} from './dto/document-requirement.dto';
import { DocumentRequirementDto } from './dto/document-response.dto';
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
import { organizationScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

/**
 * The rule that a document must exist for an admission (§11.2). Org-scoped
 * — a requirement can name a branch to restrict itself, but the caller
 * managing it operates at the organization level, matching `Guardianship`'s
 * read paths.
 */
@ApiTags('Documents: Requirements')
@ApiBearerAuth()
@Controller('document-requirements')
export class DocumentRequirementController {
  constructor(private readonly service: DocumentRequirementService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Create a document requirement' })
  @ApiCreatedEnvelope(DocumentRequirementDto)
  async create(
    @Body() dto: CreateDocumentRequirementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(
      dto,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Document requirement created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: 'List document requirements' })
  @ApiOkEnvelope(DocumentRequirementDto, { isArray: true })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.service.findAll(
      organizationScopeOf(req.context),
      branchId,
    );
    return { data, message: 'Document requirements retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Documents.View)
  @ApiOperation({ summary: 'Get a document requirement' })
  @ApiOkEnvelope(DocumentRequirementDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.service.findOne(
      id,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Document requirement retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Update a document requirement' })
  @ApiOkEnvelope(DocumentRequirementDto)
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentRequirementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(
      id,
      dto,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Document requirement updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.DocumentRequirements.Manage)
  @ApiOperation({ summary: 'Soft delete a document requirement' })
  @ApiEmptyEnvelope()
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, organizationScopeOf(req.context));
    return { message: 'Document requirement deleted successfully' };
  }
}
