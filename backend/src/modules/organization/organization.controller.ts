import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { GetUser } from '@/common/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new organization (Super Admin only)' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @GetUser('userId') userId: string,
  ) {
    const data = await this.organizationService.createOrganization(dto, userId);
    return { data, message: 'Organization created successfully' };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all organizations (Super Admin only)' })
  async findAll() {
    const data = await this.organizationService.getAllOrganizations();
    return { data, message: 'Organizations retrieved successfully' };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.organizationService.getOrganizationById(id);
    return { data, message: 'Organization details retrieved successfully' };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update organization details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @GetUser('userId') userId: string,
  ) {
    const data = await this.organizationService.updateOrganization(
      id,
      dto,
      userId,
    );
    return { data, message: 'Organization updated successfully' };
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete organization (Super Admin only)' })
  async remove(@Param('id') id: string, @GetUser('userId') userId: string) {
    const data = await this.organizationService.softDeleteOrganization(
      id,
      userId,
    );
    return { data, message: 'Organization deactivated successfully' };
  }
}
