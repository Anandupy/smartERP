import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NumberingService } from './numbering.service';
import {
  CreateNumberSequenceConfigDto,
  PreviewNumberSequenceDto,
  UpdateNumberSequenceConfigDto,
} from './dto/numbering.dto';
import {
  NumberSequenceConfigDto,
  NumberSequencePreviewDto,
} from './dto/numbering-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

/**
 * Sequence configuration.
 *
 * There is deliberately no "generate a number" endpoint. Allocation happens
 * only inside a business operation that is about to persist the result; an
 * endpoint that handed out numbers on request would guarantee gaps and invite
 * misuse.
 *
 * `x-branch-id` is optional here rather than required: an ORGANIZATION-scoped
 * sequence such as STUDENT_CODE is provisioned above any branch, and demanding
 * a branch to create one would be asking for a scope the sequence does not have.
 */
@ApiTags('Numbering')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: false,
  description: 'Target Branch UUID. Required only for branch-scoped purposes.',
})
@Controller('numbering/configs')
export class NumberingController {
  constructor(private readonly numberingService: NumberingService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({
    summary: 'Provision a sequence',
    description:
      'Scope, reset strategy and allocation mode are derived from the purpose ' +
      'and cannot be supplied. Prefix and padding become immutable once a ' +
      'NEVER-reset sequence has issued its first value.',
  })
  @ApiCreatedEnvelope(NumberSequenceConfigDto, {
    message: 'Number sequence config created successfully',
  })
  @ApiStandardErrors(400, 409)
  async create(
    @Body() dto: CreateNumberSequenceConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.numberingService.createConfig(
      dto,
      req.context.organizationId ?? '',
      req.context.branchId ?? null,
    );
    return { data, message: 'Number sequence config created successfully' };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({
    summary: 'List sequences readable from the current scope',
    description:
      "The organization's own sequences, plus the current branch's when a " +
      'branch is in context.',
  })
  @ApiOkEnvelope(NumberSequenceConfigDto, {
    isArray: true,
    message: 'Number sequence configs retrieved successfully',
  })
  @ApiStandardErrors()
  async getConfigs(@Req() req: AuthenticatedRequest) {
    const data = await this.numberingService.getConfigs(
      req.context.organizationId ?? '',
      req.context.branchId ?? null,
    );
    return { data, message: 'Number sequence configs retrieved successfully' };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Edit a sequence format' })
  @ApiOkEnvelope(NumberSequenceConfigDto, {
    message: 'Number sequence config updated successfully',
  })
  @ApiStandardErrors(400, 404)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNumberSequenceConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.numberingService.updateConfig(
      id,
      dto,
      req.context.organizationId ?? '',
    );
    return { data, message: 'Number sequence config updated successfully' };
  }

  @Post(':id/preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({
    summary: 'Render a sample without consuming a number',
    description:
      'Exists so a format change can be checked without burning a value out ' +
      'of a live series.',
  })
  @ApiOkEnvelope(NumberSequencePreviewDto, {
    message: 'Number sequence preview generated successfully',
  })
  @ApiStandardErrors(404)
  async preview(
    @Param('id') id: string,
    @Body() dto: PreviewNumberSequenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.numberingService.preview(
      id,
      dto,
      req.context.organizationId ?? '',
    );
    return { data, message: 'Number sequence preview generated successfully' };
  }
}
