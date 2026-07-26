import { Controller, Get, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { CommunicationConfigService } from './communication-config.service';
import { UpdateCommunicationConfigDto } from './dto/update-config.dto';

@ApiTags('Communication Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/communication/settings')
export class CommunicationConfigController {
  constructor(private readonly configService: CommunicationConfigService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get current communication settings' })
  async getConfig(
    @Query('organizationId') organizationId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.configService.getConfig(organizationId, branchId);
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update communication settings' })
  async updateConfig(
    @Body() dto: UpdateCommunicationConfigDto,
    @Query('organizationId') organizationId?: string,
    @Query('branchId') branchId?: string,
    @Req() req?: any,
  ) {
    return this.configService.updateConfig(dto, organizationId, branchId, req?.user?.id);
  }
}
