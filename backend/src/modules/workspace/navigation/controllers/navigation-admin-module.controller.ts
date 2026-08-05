import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { ModuleAdminService } from '../services/module-admin.service';
import { CreateModuleDto } from '../dto/module/create-module.dto';
import { UpdateModuleDto } from '../dto/module/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/module/module-status.dto';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  NavigationActionResultDto,
  NavigationModuleDetailDto,
  NavigationModuleDto,
  NavigationModuleListItemDto,
} from '../dto/navigation-response.dto';

@ApiTags('Admin - Navigation Modules')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@RequirePermission(PERMISSIONS.Settings.Manage)
@Controller('admin/navigation/modules')
export class NavigationAdminModuleController {
  constructor(private readonly moduleAdminService: ModuleAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all navigation modules' })
  @ApiOkEnvelope(NavigationModuleListItemDto, {
    isArray: true,
    message: 'Modules retrieved successfully',
  })
  @ApiStandardErrors()
  async getAllModules(): Promise<{ data: any[]; message: string }> {
    const data = await this.moduleAdminService.getAllModules();
    return { data, message: 'Modules retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get navigation module by ID' })
  @ApiOkEnvelope(NavigationModuleDetailDto, {
    message: 'Module retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getModuleById(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.moduleAdminService.getModuleById(id);
    return { data, message: 'Module retrieved successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new navigation module' })
  @ApiCreatedEnvelope(NavigationModuleDto, {
    message: 'Module created successfully',
  })
  @ApiStandardErrors(409)
  async createModule(
    @Body() dto: CreateModuleDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.moduleAdminService.createModule(dto);
    return { data, message: 'Module created successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a navigation module' })
  @ApiOkEnvelope(NavigationModuleDto, {
    message: 'Module updated successfully',
  })
  @ApiStandardErrors(404, 409)
  async updateModule(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateModuleDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.moduleAdminService.updateModule(id, dto);
    return { data, message: 'Module updated successfully' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle navigation module active status' })
  @ApiOkEnvelope(NavigationModuleDto, {
    message: 'Module status updated successfully',
  })
  @ApiStandardErrors(404)
  async updateModuleStatus(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateModuleStatusDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.moduleAdminService.updateModuleStatus(id, dto);
    return { data, message: 'Module status updated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a navigation module' })
  @ApiOkEnvelope(NavigationActionResultDto, {
    message: 'Module deleted successfully',
  })
  @ApiStandardErrors(404)
  async deleteModule(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.moduleAdminService.deleteModule(id);
    return { data, message: 'Module deleted successfully' };
  }
}
