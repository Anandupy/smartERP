import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigScope } from '@/generated/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/enums/role.enum';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import {
  organizationScopeOf,
  resourceScopeOf,
} from '@/common/scope/resource-scope';
import type { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import {
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import {
  ConfigWriteTarget,
  ConfigurationService,
} from './configuration.service';
import {
  ClearConfigValueDto,
  ConfigClearedDto,
  ConfigScopeQueryDto,
  ConfigValueDto,
  SetConfigValueDto,
} from './dto/config-value.dto';

/**
 * F2's value endpoints (§7), limited to what admission policy needs: read a
 * key's history at a scope, set it, clear it. No endpoint creates a key (D8).
 *
 * Reading the *effective* admission policy is
 * `GET /admissions/workflow/policy`, which any admissions user can call.
 */
@ApiTags('Configuration')
@ApiBearerAuth()
@Controller('config/values')
@Roles(UserRole.BRANCH_ADMIN)
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get(':key')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiParam({ name: 'key', example: 'admissions.workflow_profile' })
  @ApiOperation({
    summary: 'History of one configuration key at one scope',
    description:
      'Newest first. The ORGANIZATION and BRANCH scopes are the ones the request is already scoped to.',
  })
  @ApiOkEnvelope(ConfigValueDto, { isArray: true })
  @ApiStandardErrors(404)
  async history(
    @Param('key') key: string,
    @Query() query: ConfigScopeQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.configuration.history(
      key,
      this.targetOf(query.scopeType, req),
    );
    return { data, message: 'Configuration history retrieved successfully' };
  }

  @Put(':key')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiParam({ name: 'key', example: 'admissions.workflow_profile' })
  @ApiOperation({
    summary: 'Set a configuration value at a scope',
    description:
      'Closes the value in force at that scope and opens its successor now. Requires the key category write permission (`config.admissions.write`); ORGANIZATION scope also requires ORG_ADMIN, SYSTEM scope SUPER_ADMIN. Applications already in the workflow keep the policy in force when they entered it.',
  })
  @ApiOkEnvelope(ConfigValueDto)
  @ApiStandardErrors(400, 404, 409)
  async set(
    @Param('key') key: string,
    @Body() dto: SetConfigValueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.configuration.set(
      key,
      this.targetOf(dto.scopeType, req),
      dto.value,
      dto.reason,
      this.actorOf(req),
    );
    return { data, message: 'Configuration updated successfully' };
  }

  @Delete(':key')
  @RequirePermission(PERMISSIONS.Settings.View)
  @ApiParam({ name: 'key', example: 'admissions.workflow_profile' })
  @ApiOperation({
    summary: 'Clear a configuration value at a scope',
    description:
      'Closes the value in force at that scope; resolution falls through to the tier above. Same permissions as setting it.',
  })
  @ApiOkEnvelope(ConfigClearedDto)
  @ApiStandardErrors(400, 404, 409)
  async clear(
    @Param('key') key: string,
    @Body() dto: ClearConfigValueDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.configuration.clear(
      key,
      this.targetOf(dto.scopeType, req),
      dto.reason,
      this.actorOf(req),
    );
    return { data, message: 'Configuration cleared successfully' };
  }

  /** The scope id always comes from the validated request context. */
  private targetOf(
    scopeType: ConfigScope,
    req: AuthenticatedRequest,
  ): ConfigWriteTarget {
    switch (scopeType) {
      case ConfigScope.SYSTEM:
        return { scopeType, scopeId: null };
      case ConfigScope.ORGANIZATION:
        return {
          scopeType,
          scopeId: organizationScopeOf(req.context).organizationId,
        };
      case ConfigScope.BRANCH:
        return { scopeType, scopeId: resourceScopeOf(req.context).branchId };
      default:
        throw new BadRequestException('Unknown configuration scope.');
    }
  }

  private actorOf(req: AuthenticatedRequest) {
    return {
      userId: req.context.userId as string,
      role: req.context.role as string,
    };
  }
}
