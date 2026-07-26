import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditRepository } from './audit.repository';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.BRANCH_ADMIN,
  UserRole.STAFF,
  UserRole.STUDENT,
  UserRole.PARENT,
)
export class AuditController {
  constructor(private readonly auditRepository: AuditRepository) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve paginated, filtered audit logs' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs and pagination meta information',
  })
  async getAuditLogs(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.queryAuditLogs(req.user, query);
    return { data, message: 'Audit logs retrieved successfully' };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary statistics of audit logs' })
  @ApiResponse({
    status: 200,
    description:
      'Summary statistics grouped by module, action, severity, and status',
  })
  async getAuditSummary(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.getAuditSummary(req.user, query);
    return { data, message: 'Audit summary retrieved successfully' };
  }

  @Get('timeline')
  @ApiOperation({
    summary: 'Get chronological activity timeline and daily trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Timeline events and daily log activity counts',
  })
  async getAuditTimeline(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.getAuditTimeline(req.user, query);
    return { data, message: 'Audit timeline retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific audit log by ID' })
  @ApiResponse({
    status: 200,
    description:
      'Audit log detailed information including metadata and changes',
  })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden access to this resource',
  })
  async getAuditLogById(@Param('id') id: string, @Req() req: any) {
    const log = await this.auditRepository.getAuditLogById(req.user, id);

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    if (log === 'FORBIDDEN') {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return { data: log, message: 'Audit log details retrieved successfully' };
  }
}
