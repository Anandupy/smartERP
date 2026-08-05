import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { NumberingService } from './numbering.service';
import { CreateNumberSequenceConfigDto } from './dto/numbering.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { NumberSequenceConfigDto } from './dto/numbering-response.dto';

@ApiTags('Number Generation Configs')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID',
})
@RequireBranch()
@Controller('admissions/numbering/configs')
export class NumberingController {
  constructor(private readonly numberingService: NumberingService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create a new numbering sequence config' })
  @ApiCreatedEnvelope(NumberSequenceConfigDto, {
    message: 'Number sequence config created successfully',
  })
  @ApiStandardErrors(409)
  async create(@Body() dto: CreateNumberSequenceConfigDto, @Req() req: any) {
    const orgId = req.context?.organizationId || '';
    const branchId = req.context?.branchId || '';
    const data = await this.numberingService.createConfig(dto, orgId, branchId);
    return { data, message: 'Number sequence config created successfully' };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get all number configs for branch' })
  @ApiOkEnvelope(NumberSequenceConfigDto, {
    isArray: true,
    message: 'Number sequence configs retrieved successfully',
  })
  @ApiStandardErrors()
  async getConfigs(@Req() req: any) {
    const branchId = req.context?.branchId || '';
    const data = await this.numberingService.getConfigs(branchId);
    return { data, message: 'Number sequence configs retrieved successfully' };
  }
}
