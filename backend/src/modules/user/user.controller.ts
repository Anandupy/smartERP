import { Controller, Get, Post, Patch, Param, Body, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create user (Admin only)' })
  async create(@Body() dto: CreateUserDto, @Headers('x-user-id') creatorId?: string) {
    const data = await this.userService.createUser(dto, creatorId);
    return { data, message: 'User created successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.userService.findById(id);
    return { data, message: 'User retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Headers('x-user-id') updaterId?: string,
  ) {
    const data = await this.userService.updateUser(id, dto, updaterId);
    return { data, message: 'User updated successfully' };
  }
}
