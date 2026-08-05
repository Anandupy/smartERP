import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditRepository } from './audit.repository';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiOkEnvelope,
  ApiPaginatedItemsEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  AuditLogDto,
  AuditSummaryDto,
  AuditTimelineDto,
} from './dto/audit-response.dto';

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
  @ApiPaginatedItemsEnvelope(AuditLogDto, {
    message: 'Audit logs retrieved successfully',
    description:
      'Pagination is nested inside `data` as `{ items, meta }`. `metadata` and `changes` appear on a row only when the query sets `includeDetails`.',
  })
  @ApiStandardErrors()
  async getAuditLogs(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.queryAuditLogs(req.user, query);
    return { data, message: 'Audit logs retrieved successfully' };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary statistics of audit logs' })
  @ApiOkEnvelope(AuditSummaryDto, {
    message: 'Audit summary retrieved successfully',
  })
  @ApiStandardErrors()
  async getAuditSummary(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.getAuditSummary(req.user, query);
    return { data, message: 'Audit summary retrieved successfully' };
  }

  @Get('timeline')
  @ApiOperation({
    summary: 'Get chronological activity timeline and daily trends',
  })
  @ApiOkEnvelope(AuditTimelineDto, {
    message: 'Audit timeline retrieved successfully',
  })
  @ApiStandardErrors()
  async getAuditTimeline(@Query() query: AuditQueryDto, @Req() req: any) {
    const data = await this.auditRepository.getAuditTimeline(req.user, query);
    return { data, message: 'Audit timeline retrieved successfully' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific audit log by ID' })
  @ApiOkEnvelope(AuditLogDto, {
    message: 'Audit log details retrieved successfully',
    description:
      'Reading a log outside the caller’s organization or branch is refused with 403 rather than 404, so the id is not confirmed either way.',
  })
  @ApiStandardErrors(404)
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
