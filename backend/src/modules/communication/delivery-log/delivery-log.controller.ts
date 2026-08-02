import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { DeliveryLogService } from './delivery-log.service';
import { QueryDeliveryLogDto } from './dto/query-delivery-log.dto';

@ApiTags('Communication Delivery Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('communication/delivery-logs')
export class DeliveryLogController {
  constructor(private readonly deliveryLogService: DeliveryLogService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Query paginated communication delivery logs' })
  async findAll(@Query() query: QueryDeliveryLogDto) {
    return this.deliveryLogService.findAll(query);
  }

  @Get('analytics')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Get operational delivery metrics & statistics' })
  async getAnalytics(
    @Query('organizationId') organizationId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.deliveryLogService.getAnalytics(organizationId, branchId);
  }
}
