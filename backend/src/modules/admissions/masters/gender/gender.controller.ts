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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { GenderService } from './gender.service';
import { CreateMasterDto, UpdateMasterDto } from '../dto/master.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  ApiCreatedEnvelope,
  ApiEmptyEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { AdmissionMasterDto } from '../dto/master-response.dto';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Admissions Masters: Gender')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/masters/genders')
export class GenderController {
  constructor(private readonly service: GenderService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create a gender' })
  @ApiCreatedEnvelope(AdmissionMasterDto)
  @ApiStandardErrors()
  async create(@Body() dto: CreateMasterDto, @Req() req: any) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.create(dto, orgId, branchId);
    return { data, message: 'Gender created successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get all genders' })
  @ApiOkEnvelope(AdmissionMasterDto, { isArray: true })
  @ApiStandardErrors()
  async findAll(
    @Req() req: any,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.findAll(orgId, branchId, includeInactive);
    return { data, message: 'Genders retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get gender by ID' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'Gender retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update gender' })
  @ApiOkEnvelope(AdmissionMasterDto)
  @ApiStandardErrors(404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
    @Req() req: any,
  ) {
    const orgId = req.context?.organizationId || null;
    const branchId = req.context?.branchId || null;
    const data = await this.service.update(id, dto, orgId, branchId);
    return { data, message: 'Gender updated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Soft delete gender' })
  @ApiEmptyEnvelope()
  @ApiStandardErrors(404)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: 'Gender deleted successfully' };
  }
}
