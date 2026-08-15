import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { RelationTypeService } from './relation-type.service';
import { CreateMasterDto, UpdateMasterDto } from '../dto/master.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { AdmissionMasterDto } from '../dto/master-response.dto';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

@ApiTags('Admissions Masters: Relation Type')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/masters/relation-types')
export class RelationTypeController {
  constructor(private readonly service: RelationTypeService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Create)
  @ApiOperation({ summary: 'Create a relation type' })
  @ApiCreatedEnvelope(AdmissionMasterDto)
  @ApiStandardErrors()
  async create(@Body() dto: CreateMasterDto, @Req() req: AuthenticatedRequest) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.create(dto, scope);
    return { data, message: 'Relation type created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.AdmissionsMasters.View)
  @ApiOperation({ summary: 'Get all relation types' })
  @ApiOkEnvelope(AdmissionMasterDto, { isArray: true })
  @ApiStandardErrors()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.findAll(scope, includeInactive);
    return { data, message: 'Relation types retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.AdmissionsMasters.View)
  @ApiOperation({ summary: 'Get relation type by ID' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.service.findOne(id, resourceScopeOf(req.context));
    return { data, message: 'Relation type retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Update)
  @ApiOperation({ summary: 'Update relation type' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.update(id, dto, scope);
    return { data, message: 'Relation type updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Delete)
  @ApiOperation({ summary: 'Soft delete relation type' })
  @ApiEmptyEnvelope()
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, resourceScopeOf(req.context));
    return { message: 'Relation type deleted successfully' };
  }
}
