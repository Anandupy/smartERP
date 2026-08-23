import { Controller, Get, Post, Patch, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { AllowDuringSetup } from '@/common/decorators/allow-during-setup.decorator';
import { AllowUnresolvedContext } from '@/common/decorators/allow-unresolved-context.decorator';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
// Every user-returning endpoint selects the same columns, so one DTO describes
// them all. Declared with auth because `GET /auth/me` embeds it.
import { UserProfileDto } from '@/modules/auth/dto/auth-response.dto';

// User management is not itself scoped to one selected tenant: a SUPER_ADMIN
// targets whichever organization a request names (in the body, for create;
// implicitly, via the target user, for read/update), the same way
// `OrganizationController` does not require a pre-selected organization to
// create the next one. Tenant isolation for ORG_ADMIN is enforced inside
// `UserService` against `req.context`, not by requiring a header here.
@ApiTags('Users')
@ApiBearerAuth()
@AllowUnresolvedContext()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @AllowDuringSetup()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Create user (Admin only)',
    description:
      'SUPER_ADMIN may assign any role, including ORG_ADMIN — the path used to provision a client administrator during setup. ORG_ADMIN may only assign BRANCH_ADMIN, STAFF, STUDENT or PARENT, scoped to their own organization.',
  })
  @ApiCreatedEnvelope(UserProfileDto, { message: 'User created successfully' })
  @ApiStandardErrors(403, 404, 409)
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    const data = await this.userService.createUser(
      dto,
      req.userId,
      req.context,
    );
    return { data, message: 'User created successfully' };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkEnvelope(UserProfileDto, { message: 'User retrieved successfully' })
  @ApiStandardErrors(403, 404)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const data = await this.userService.findByIdForActor(id, req.context);
    return { data, message: 'User retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update user' })
  @ApiOkEnvelope(UserProfileDto, { message: 'User updated successfully' })
  @ApiStandardErrors(403, 404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    const data = await this.userService.updateUser(
      id,
      dto,
      req.userId,
      req.context,
    );
    return { data, message: 'User updated successfully' };
  }
}
