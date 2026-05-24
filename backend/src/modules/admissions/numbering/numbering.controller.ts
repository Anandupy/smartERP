import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NumberingService } from './numbering.service';
import { CreateNumberSequenceConfigDto } from './dto/numbering.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Number Generation Configs')
@ApiBearerAuth()
@Controller('admissions/numbering/configs')
export class NumberingController {
  constructor(private readonly numberingService: NumberingService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Create a new numbering sequence config' })
  async create(@Body() dto: CreateNumberSequenceConfigDto, @Req() req: any) {
    const orgId = req.context?.organizationId || '';
    const branchId = req.context?.branchId || '';
    const data = await this.numberingService.createConfig(dto, orgId, branchId);
    return { data, message: 'Number sequence config created successfully' };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get all number configs for branch' })
  async getConfigs(@Req() req: any) {
    const branchId = req.context?.branchId || '';
    const data = await this.numberingService.getConfigs(branchId);
    return { data, message: 'Number sequence configs retrieved successfully' };
  }
}
