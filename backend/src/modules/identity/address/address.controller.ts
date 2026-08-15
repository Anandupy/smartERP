import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { AttachAddressDto, ResolveAddressQueryDto } from './dto/address.dto';
import { PersonAddressDto } from './dto/address-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiCreatedEnvelope,
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { organizationScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

/**
 * S2 — Address, resolved through Person.
 *
 * Organization-scoped, matching Person: an address is not branch-owned, and a
 * guardian in one branch and a child in another must be able to share one
 * within the same organization.
 *
 * There is no `Household`. Sharing is two Persons' `PersonAddress` rows
 * pointing at one `Address` — see
 * docs/planning/core-admission-lifecycle-specification.md §9.2, §10.3.
 */
@ApiTags('Identity — Address')
@ApiBearerAuth()
@Controller('persons/:personId/addresses')
export class AddressController {
  constructor(private readonly service: AddressService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Person.AttachAddress)
  @ApiOperation({
    summary: 'Attach or replace an address for an identity',
    description:
      'Closes any existing open link of the same addressType and opens a new one. ' +
      'The Address row itself is immutable and shared across every Person at the same location.',
  })
  @ApiCreatedEnvelope(PersonAddressDto, {
    message: 'Address attached successfully',
  })
  @ApiStandardErrors(400, 404, 409)
  async attach(
    @Param('personId') personId: string,
    @Body() dto: AttachAddressDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { organizationId } = organizationScopeOf(req.context);
    const data = await this.service.attach(
      organizationId,
      personId,
      dto,
      req.userId ?? 'SYSTEM',
    );
    return { data, message: 'Address attached successfully' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Person.View)
  @ApiOperation({
    summary: "List an identity's addresses",
    description:
      'Current links only unless includeHistorical=true. Historical links stay ' +
      'readable so a certificate issued years ago can be explained.',
  })
  @ApiOkEnvelope(PersonAddressDto, { isArray: true })
  @ApiStandardErrors(404)
  async list(
    @Param('personId') personId: string,
    @Req() req: AuthenticatedRequest,
    @Query('includeHistorical') includeHistorical?: boolean,
  ) {
    const { organizationId } = organizationScopeOf(req.context);
    const data = await this.service.list(
      organizationId,
      personId,
      includeHistorical,
    );
    return { data, message: 'Addresses retrieved successfully' };
  }

  @Get('resolve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Person.View)
  @ApiOperation({
    summary: 'Resolve the address of a given type for an identity',
    description:
      'COMMUNICATION falls back to CURRENT when unset. BILLING resolution through ' +
      'the financial guardian is not implemented (Guardian has no personId yet); it ' +
      'falls back to CURRENT the same way.',
  })
  @ApiOkEnvelope(PersonAddressDto, { nullable: true })
  @ApiStandardErrors(404)
  async resolve(
    @Param('personId') personId: string,
    @Query() query: ResolveAddressQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { organizationId } = organizationScopeOf(req.context);
    const asOf = query.asOf ? new Date(query.asOf) : undefined;
    const data = await this.service.resolve(
      organizationId,
      personId,
      query.type,
      asOf,
    );
    return { data, message: 'Address resolved successfully' };
  }
}
