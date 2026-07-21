import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AdmissionSourceService } from './admission-source.service';
import { CreateMasterDto, UpdateMasterDto } from '../dto/master.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Admissions Masters: Admission Source')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/masters/admission-sources')
export class AdmissionSourceController {
  constructor(private readonly service: AdmissionSourceService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create an admission source' })
  async create(@Body() dto: CreateMasterDto, @Req() req: any) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.create(dto, orgId, branchId);
    return { data, message: 'Admission source created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get all admission sources' })
  async findAll(
    @Req() req: any,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.findAll(orgId, branchId, includeInactive);
    return { data, message: 'Admission sources retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get admission source by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'Admission source retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update admission source' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
    @Req() req: any,
  ) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.update(id, dto, orgId, branchId);
    return { data, message: 'Admission source updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Soft delete admission source' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: 'Admission source deleted successfully' };
  }
}
