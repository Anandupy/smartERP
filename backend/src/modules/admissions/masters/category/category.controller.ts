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
import { CategoryService } from './category.service';
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

@ApiTags('Admissions Masters: Category')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/masters/categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Create)
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedEnvelope(AdmissionMasterDto)
  @ApiStandardErrors()
  async create(@Body() dto: CreateMasterDto, @Req() req: AuthenticatedRequest) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.create(dto, scope);
    return { data, message: 'Category created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.AdmissionsMasters.View)
  @ApiOperation({ summary: 'Get all categories' })
  @ApiOkEnvelope(AdmissionMasterDto, { isArray: true })
  @ApiStandardErrors()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.findAll(scope, includeInactive);
    return { data, message: 'Categories retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.AdmissionsMasters.View)
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.service.findOne(id, resourceScopeOf(req.context));
    return { data, message: 'Category retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Update)
  @ApiOperation({ summary: 'Update category' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context);
    const data = await this.service.update(id, dto, scope);
    return { data, message: 'Category updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.AdmissionsMasters.Delete)
  @ApiOperation({ summary: 'Soft delete category' })
  @ApiEmptyEnvelope()
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, resourceScopeOf(req.context));
    return { message: 'Category deleted successfully' };
  }
}
