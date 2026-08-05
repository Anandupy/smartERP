import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { MenuAdminService } from '../services/menu-admin.service';
import { CreateMenuDto } from '../dto/menu/create-menu.dto';
import { UpdateMenuDto } from '../dto/menu/update-menu.dto';
import { MoveMenuDto } from '../dto/menu/move-menu.dto';
import { ReorderMenusDto } from '../dto/menu/reorder-menu.dto';
import { UpdateMenuStatusDto } from '../dto/menu/menu-status.dto';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  NavigationActionResultDto,
  NavigationMenuDetailDto,
  NavigationMenuDto,
  NavigationMenuListItemDto,
} from '../dto/navigation-response.dto';

@ApiTags('Admin - Navigation Menus')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@RequirePermission(PERMISSIONS.Settings.Manage)
@Controller('admin/navigation/menus')
export class NavigationAdminMenuController {
  constructor(private readonly menuAdminService: MenuAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all navigation menus' })
  @ApiQuery({ name: 'moduleId', required: false, type: String })
  @ApiOkEnvelope(NavigationMenuListItemDto, {
    isArray: true,
    message: 'Menus retrieved successfully',
  })
  @ApiStandardErrors()
  async getAllMenus(
    @Query('moduleId') moduleId?: string,
  ): Promise<{ data: any[]; message: string }> {
    const data = await this.menuAdminService.getAllMenus(moduleId);
    return { data, message: 'Menus retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get navigation menu by ID' })
  @ApiOkEnvelope(NavigationMenuDetailDto, {
    message: 'Menu retrieved successfully',
  })
  @ApiStandardErrors(404)
  async getMenuById(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.getMenuById(id);
    return { data, message: 'Menu retrieved successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new navigation menu' })
  @ApiCreatedEnvelope(NavigationMenuDto, {
    message: 'Menu item created successfully',
  })
  @ApiStandardErrors(404, 409)
  async createMenu(
    @Body() dto: CreateMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.createMenu(dto);
    return { data, message: 'Menu item created successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a navigation menu' })
  @ApiOkEnvelope(NavigationMenuDto, {
    message: 'Menu item updated successfully',
  })
  @ApiStandardErrors(404, 409)
  async updateMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.updateMenu(id, dto);
    return { data, message: 'Menu item updated successfully' };
  }

  @Patch(':id/move')
  @ApiOperation({
    summary:
      'Move navigation menu (change parent/module) with hierarchy validation',
  })
  @ApiOkEnvelope(NavigationMenuDto, {
    description: 'Rejected with 400 when the move would create a cycle.',
    message: 'Menu item moved successfully',
  })
  @ApiStandardErrors(404)
  async moveMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: MoveMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.moveMenu(id, dto);
    return { data, message: 'Menu item moved successfully' };
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Bulk reorder navigation menu display ranks' })
  @ApiOkEnvelope(NavigationActionResultDto, {
    message: 'Menus reordered successfully',
  })
  @ApiStandardErrors(404)
  async reorderMenus(
    @Body() dto: ReorderMenusDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.reorderMenus(dto);
    return { data, message: 'Menus reordered successfully' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update menu status' })
  @ApiOkEnvelope(NavigationMenuDto, {
    message: 'Menu status updated successfully',
  })
  @ApiStandardErrors(404)
  async updateMenuStatus(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateMenuStatusDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.updateMenuStatus(id, dto);
    return { data, message: 'Menu status updated successfully' };
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a navigation menu' })
  @ApiCreatedEnvelope(NavigationMenuDto, {
    message: 'Menu item duplicated successfully',
  })
  @ApiStandardErrors(404)
  async duplicateMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.duplicateMenu(id);
    return { data, message: 'Menu item duplicated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a navigation menu' })
  @ApiOkEnvelope(NavigationActionResultDto, {
    message: 'Menu item deleted successfully',
  })
  @ApiStandardErrors(404)
  async deleteMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.deleteMenu(id);
    return { data, message: 'Menu item deleted successfully' };
  }
}
