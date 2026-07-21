import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { GuardiansService } from './guardians.service';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
  MapGuardianDto,
} from './dto/guardian.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Guardians')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/guardians')
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create a new guardian' })
  async create(@Body() dto: CreateGuardianDto, @Req() req: any) {
    const orgId = req.context?.organizationId || '';
    const branchId = req.context?.branchId || '';
    const data = await this.service.create(dto, orgId, branchId);
    return { data, message: 'Guardian created successfully' };
  }

  @Get('search')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({
    summary:
      'Search guardians for sibling reuse (search by primary mobile, aadhaar, or name)',
  })
  async search(@Query('q') query: string, @Req() req: any) {
    const branchId = req.context?.branchId || '';
    const data = await this.service.search(query, branchId);
    return { data, message: 'Guardians search results' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get guardian by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { data, message: 'Guardian retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Update guardian details' })
  async update(@Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    const data = await this.service.update(id, dto);
    return { data, message: 'Guardian updated successfully' };
  }

  // Applicant mapping endpoints
  @Post('applicant/:applicantId/map')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Map a guardian to an applicant' })
  async map(
    @Param('applicantId') applicantId: string,
    @Body() dto: MapGuardianDto,
  ) {
    const data = await this.service.mapGuardianToApplicant(applicantId, dto);
    return { data, message: 'Guardian mapped to applicant successfully' };
  }

  @Get('applicant/:applicantId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({ summary: 'Get all guardians mapped to an applicant' })
  async getMapped(@Param('applicantId') applicantId: string) {
    const data = await this.service.getMappedGuardians(applicantId);
    return { data, message: 'Mapped guardians retrieved successfully' };
  }

  @Delete('applicant/:applicantId/map/:guardianId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Remove a guardian mapping from an applicant' })
  async removeMap(
    @Param('applicantId') applicantId: string,
    @Param('guardianId') guardianId: string,
  ) {
    await this.service.removeMapping(applicantId, guardianId);
    return { message: 'Guardian mapping removed successfully' };
  }
}
