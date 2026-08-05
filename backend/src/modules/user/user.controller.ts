import { Controller, Get, Post, Patch, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
// Every user-returning endpoint selects the same columns, so one DTO describes
// them all. Declared with auth because `GET /auth/me` embeds it.
import { UserProfileDto } from '@/modules/auth/dto/auth-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create user (Admin only)' })
  @ApiCreatedEnvelope(UserProfileDto, { message: 'User created successfully' })
  @ApiStandardErrors(409)
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const data = await this.userService.createUser(dto, req.userId);
    return { data, message: 'User created successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkEnvelope(UserProfileDto, { message: 'User retrieved successfully' })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.userService.findById(id);
    return { data, message: 'User retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update user' })
  @ApiOkEnvelope(UserProfileDto, { message: 'User updated successfully' })
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    const data = await this.userService.updateUser(id, dto, req.userId);
    return { data, message: 'User updated successfully' };
  }
}
