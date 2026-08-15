import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardianshipService } from './guardianship.service';
import { GuardianshipDto } from './dto/guardian-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiOkEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { organizationScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';

/**
 * Guardianship, read-only.
 *
 * Organization-scoped, not branch-scoped — matching Person and Address
 * (R4): a guardian in one branch and a child in another must be reachable
 * within the same organization. There is no write endpoint here.
 * `Guardianship` rows are a projection of `ApplicantGuardianMapping`,
 * written by `GuardiansService.mapGuardianToApplicant` and by
 * `AdmissionConversionService.admit()` — never directly.
 */
@ApiTags('Guardianships')
@ApiBearerAuth()
@Controller('admissions/guardianships')
export class GuardianshipController {
  constructor(private readonly service: GuardianshipService) {}

  @Get('ward/:wardPersonId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Guardian.View)
  @ApiOperation({
    summary: "List a student's active guardians",
    description:
      'Reachable regardless of how the Student came to exist — through a ' +
      'sourceApplicantId or migrated directly — because this reads Person-to-' +
      'Person Guardianship rows, not the applicant-scoped mapping.',
  })
  @ApiOkEnvelope(GuardianshipDto, { isArray: true })
  @ApiStandardErrors(404)
  async findByWard(
    @Param('wardPersonId') wardPersonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.findByWard(
      wardPersonId,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Guardianships retrieved successfully' };
  }

  @Get('ward/:wardPersonId/siblings')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Guardian.View)
  @ApiOperation({
    summary: 'List siblings — wards sharing an active guardian',
    description:
      'Derived at query time from shared Guardianship rows. There is no ' +
      'sibling or household table (§9.2, DECIDED).',
  })
  @ApiOkEnvelope('string', { isArray: true })
  @ApiStandardErrors(404)
  async findSiblings(
    @Param('wardPersonId') wardPersonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.findSiblings(
      wardPersonId,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Siblings retrieved successfully' };
  }

  @Get('guardian/:guardianPersonId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Guardian.View)
  @ApiOperation({
    summary: "List a person's active wards",
    description: 'Which children this Person is an active guardian for.',
  })
  @ApiOkEnvelope(GuardianshipDto, { isArray: true })
  @ApiStandardErrors(404)
  async findByGuardianPerson(
    @Param('guardianPersonId') guardianPersonId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.findByGuardianPerson(
      guardianPersonId,
      organizationScopeOf(req.context),
    );
    return { data, message: 'Wards retrieved successfully' };
  }
}
