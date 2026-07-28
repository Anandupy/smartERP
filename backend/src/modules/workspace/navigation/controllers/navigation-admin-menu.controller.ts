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
  ApiResponse,
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

@ApiTags('Admin - Navigation Menus')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@RequirePermission(PERMISSIONS.Settings.Manage)
@Controller('v1/admin/navigation/menus')
export class NavigationAdminMenuController {
  constructor(private readonly menuAdminService: MenuAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all navigation menus' })
  @ApiQuery({ name: 'moduleId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Menus retrieved successfully' })
  async getAllMenus(
    @Query('moduleId') moduleId?: string,
  ): Promise<{ data: any[]; message: string }> {
    const data = await this.menuAdminService.getAllMenus(moduleId);
    return { data, message: 'Menus retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get navigation menu by ID' })
  @ApiResponse({ status: 200, description: 'Menu retrieved successfully' })
  async getMenuById(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.getMenuById(id);
    return { data, message: 'Menu retrieved successfully' };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new navigation menu item' })
  @ApiResponse({ status: 201, description: 'Menu item created successfully' })
  async createMenu(
    @Body() dto: CreateMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.createMenu(dto);
    return { data, message: 'Menu item created successfully' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a navigation menu item' })
  @ApiResponse({ status: 200, description: 'Menu item updated successfully' })
  async updateMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.updateMenu(id, dto);
    return { data, message: 'Menu item updated successfully' };
  }

  @Patch(':id/move')
  @ApiOperation({
    summary: 'Move menu item (change parent/module) with hierarchy validation',
  })
  @ApiResponse({ status: 200, description: 'Menu item moved successfully' })
  async moveMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: MoveMenuDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.moveMenu(id, dto);
    return { data, message: 'Menu item moved successfully' };
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Bulk reorder navigation menu display ranks' })
  @ApiResponse({ status: 200, description: 'Menus reordered successfully' })
  async reorderMenus(
    @Body() dto: ReorderMenusDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.reorderMenus(dto);
    return { data, message: 'Menus reordered successfully' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update menu status' })
  @ApiResponse({
    status: 200,
    description: 'Menu status updated successfully',
  })
  async updateMenuStatus(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateMenuStatusDto,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.updateMenuStatus(id, dto);
    return { data, message: 'Menu status updated successfully' };
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a navigation menu item' })
  @ApiResponse({
    status: 201,
    description: 'Menu item duplicated successfully',
  })
  async duplicateMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.duplicateMenu(id);
    return { data, message: 'Menu item duplicated successfully' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a navigation menu item' })
  @ApiResponse({ status: 200, description: 'Menu item deleted successfully' })
  async deleteMenu(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<{ data: any; message: string }> {
    const data = await this.menuAdminService.deleteMenu(id);
    return { data, message: 'Menu item deleted successfully' };
  }
}
