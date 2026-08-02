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
  @ApiOperation({ summary: 'Get all organizations' })
  async findAll() {
    const data = await this.organizationService.getAllOrganizations();
    return { data, message: 'Organizations retrieved successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.organizationService.getOrganizationById(id);
    return { data, message: 'Organization retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Update organization' })
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
  @ApiOperation({ summary: 'Soft delete organization (Super Admin only)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.organizationService.softDeleteOrganization(
      id,
      req.userId,
    );
    return { data, message: 'Organization deactivated successfully' };
  }
}
