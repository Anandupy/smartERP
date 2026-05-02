import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Organizations')
@ApiHeader({ name: 'x-role', description: 'User role for simulation', required: true })
@Controller('organizations')
@UseGuards(RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new organization (Super Admin only)' })
  async create(@Body() dto: CreateOrganizationDto) {
    const data = await this.organizationService.createOrganization(dto);
    return { data, message: 'Organization created successfully' };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get all organizations' })
  async findAll() {
    const data = await this.organizationService.getAllOrganizations();
    return { data, message: 'Organizations retrieved successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.organizationService.getOrganizationById(id);
    return { data, message: 'Organization retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update organization' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    const data = await this.organizationService.updateOrganization(id, dto);
    return { data, message: 'Organization updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete organization (Super Admin only)' })
  async remove(@Param('id') id: string) {
    const data = await this.organizationService.softDeleteOrganization(id);
    return { data, message: 'Organization deactivated successfully' };
  }
}
