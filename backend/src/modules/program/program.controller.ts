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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgramService } from './program.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Programs')
@ApiBearerAuth()
@Controller('programs')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create a new program' })
  async create(@Body() createProgramDto: CreateProgramDto, @Req() req: any) {
    // If not super admin, enforce branchId from context
    if (req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId) {
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
  @ApiOperation({ summary: 'Get all programs for a branch' })
  async findAll(@Query('branchId') branchId: string, @Req() req: any) {
    // If not super admin, enforce branchId from context
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId;

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
  @ApiOperation({ summary: 'Get hierarchical program tree for a branch' })
  async getTree(@Query('branchId') branchId: string, @Req() req: any) {
    // If not super admin, enforce branchId from context
    const targetBranchId =
      req.context?.role !== UserRole.SUPER_ADMIN && req.context?.branchId
        ? req.context.branchId
        : branchId;

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
  @ApiOperation({ summary: 'Get program by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.programService.findById(id);
    return { data, message: 'Program retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update program' })
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
  @ApiOperation({ summary: 'Soft delete program' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const data = await this.programService.softDeleteProgram(id, req.userId);
    return { data, message: 'Program deleted successfully' };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Toggle program status' })
  async toggleStatus(@Param('id') id: string, @Req() req: any) {
    const data = await this.programService.toggleProgramStatus(id, req.userId);
    return { data, message: 'Program status toggled successfully' };
  }
}
