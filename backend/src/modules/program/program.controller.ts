import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ProgramService } from './program.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  ProgramDetailDto,
  ProgramDto,
  ProgramTreeNodeDto,
  ProgramWithParentDto,
} from './dto/program-response.dto';

@ApiTags('Programs')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('programs')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({ summary: 'Create a new program' })
  @ApiCreatedEnvelope(ProgramDto, { message: 'Program created successfully' })
  @ApiStandardErrors(404, 409)
  async create(@Body() createProgramDto: CreateProgramDto, @Req() req: any) {
    if (req.context?.branchId && !createProgramDto.branchId) {
      createProgramDto.branchId = req.context.branchId;
    }
    const data = await this.programService.createProgram(
      createProgramDto,
      req.userId,
    );
    return { data, message: 'Program created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get all programs for a branch',
    description:
      'Soft-deleted programs are excluded, so the count is the branch’s live programs. Scoped to one branch — there is no cross-branch listing.',
  })
  @ApiOkEnvelope(ProgramWithParentDto, {
    isArray: true,
    message: 'Programs retrieved successfully',
  })
  @ApiStandardErrors()
  async findAll(@Query('branchId') branchId: string, @Req() req: any) {
    const targetBranchId = req.context?.branchId || branchId;

    const data = await this.programService.getProgramsByBranch(targetBranchId);
    return { data, message: 'Programs retrieved successfully' };
  }

  @Get('tree')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({
    summary: 'Get hierarchical program tree for a branch',
    description:
      'The same programs as `GET /programs`, nested under their parents instead of flat.',
  })
  @ApiOkEnvelope(ProgramTreeNodeDto, {
    isArray: true,
    message: 'Program tree retrieved successfully',
  })
  @ApiStandardErrors()
  async getTree(@Query('branchId') branchId: string, @Req() req: any) {
    const targetBranchId = req.context?.branchId || branchId;

    const data = await this.programService.getProgramTree(targetBranchId);
    return { data, message: 'Program tree retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiOperation({ summary: 'Get program by ID' })
  @ApiOkEnvelope(ProgramDetailDto, {
    message: 'Program retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.programService.findById(id);
    return { data, message: 'Program retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Update program',
    description:
      'Accepts a partial body — send only the fields being changed. Omitted fields are left as they are.',
  })
  @ApiOkEnvelope(ProgramDto, { message: 'Program updated successfully' })
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() updateProgramDto: UpdateProgramDto,
    @Req() req: any,
  ) {
    const data = await this.programService.updateProgram(
      id,
      updateProgramDto,
      req.userId,
    );
    return { data, message: 'Program updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Soft delete program',
    description:
      'Rejected with 400 while the program still has active sub-programs.',
  })
  @ApiOkEnvelope(ProgramDto, { message: 'Program deleted successfully' })
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.programService.softDeleteProgram(id, req.userId);
    return { data, message: 'Program deleted successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Settings.Manage)
  @ApiOperation({
    summary: 'Toggle program status',
    description:
      'Takes no body: it flips the current value rather than setting a target state, so it is **not idempotent** — sending it twice returns to where it started. Read the record first if the resulting state matters.',
  })
  @ApiOkEnvelope(ProgramDto, { message: 'Program status toggled successfully' })
  @ApiStandardErrors(404)
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.programService.toggleProgramStatus(id, req.userId);
    return { data, message: 'Program status toggled successfully' };
  }
}
