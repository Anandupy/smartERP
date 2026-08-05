import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { OrganizationDto } from './dto/organization-response.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Create a new organization (Super Admin only)' })
  @ApiCreatedEnvelope(OrganizationDto, {
    message: 'Organization created successfully',
  })
  @ApiStandardErrors(409)
  async create(@Body() dto: CreateOrganizationDto, @Req() req: any) {
    const data = await this.organizationService.createOrganization(
      dto,
      req.userId,
    );
    return { data, message: 'Organization created successfully' };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get all organizations',
    description:
      'Returns ACTIVE and SUSPENDED organizations. INACTIVE ones — which is what a soft delete sets — are excluded, and no parameter widens this, so a deactivated organization is not reachable through any list.',
  })
  @ApiOkEnvelope(OrganizationDto, {
    isArray: true,
    message: 'Organizations retrieved successfully',
  })
  @ApiStandardErrors()
  async findAll() {
    const data = await this.organizationService.getAllOrganizations();
    return { data, message: 'Organizations retrieved successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiOkEnvelope(OrganizationDto, {
    message: 'Organization retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.organizationService.getOrganizationById(id);
    return { data, message: 'Organization retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Update organization',
    description:
      'Accepts a partial body — send only the fields being changed. Omitted fields are left as they are.',
  })
  @ApiOkEnvelope(OrganizationDto, {
    message: 'Organization updated successfully',
  })
  @ApiStandardErrors(404, 409)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: any,
  ) {
    const data = await this.organizationService.updateOrganization(
      id,
      dto,
      req.userId,
    );
    return { data, message: 'Organization updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Soft delete organization (Super Admin only)',
    description:
      'Sets status to INACTIVE and returns the updated record — the row is not removed.',
  })
  @ApiOkEnvelope(OrganizationDto, {
    message: 'Organization deactivated successfully',
  })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.organizationService.softDeleteOrganization(
      id,
      req.userId,
    );
    return { data, message: 'Organization deactivated successfully' };
  }
}
