import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PersonService } from './person.service';
import {
  AttachGovernmentIdDto,
  FindPersonCandidatesDto,
  RecordMatchDecisionDto,
} from './dto/person.dto';
import {
  AttachGovernmentIdResultDto,
  MatchDecisionResultDto,
  PersonCandidateDto,
  PersonIdentityDto,
} from './dto/person-response.dto';
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
import { maskAadhaar } from '@/infrastructure/crypto/masking.util';

/**
 * Identity index.
 *
 * Organization-scoped rather than branch-scoped: a human is not branch-owned,
 * and matching has to see the whole organization or a sibling at another branch
 * is invisible to it.
 *
 * **There is no `POST /persons`.** A Person has no independent meaning — a
 * standalone create would let staff manufacture identity rows with nothing
 * attached, which is noise at best and a way to pre-seed a chosen identity at
 * worst. Persons are created only as a side effect of `resolve()`, called by
 * the module that is creating an applicant, guardian or employee.
 *
 * **There is no reveal endpoint.** Nothing here decrypts a government
 * identifier. The permissioned reveal ships together with the access log that
 * DPDP requires for it; shipping the reveal first would mean reads nobody can
 * account for. See docs/core/key-custody.md.
 */
@ApiTags('Identity — Person')
@ApiBearerAuth()
@Controller('persons')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Post('match')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Person.Search)
  @ApiOperation({
    summary: 'Find identities that might be the same human',
    description:
      'Suggestions only, never a conclusion. A government identifier is not accepted as a ' +
      'search term — matching on one is deterministic and belongs to identity resolution, ' +
      'and accepting it here would answer "does this organization hold this identifier?" ' +
      'for anyone who can call the endpoint.',
  })
  @ApiCreatedEnvelope(PersonCandidateDto, {
    isArray: true,
    message: 'Candidate identities retrieved successfully',
  })
  @ApiStandardErrors()
  async findCandidates(
    @Body() dto: FindPersonCandidatesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { organizationId } = organizationScopeOf(req.context);

    const data = await this.personService.findCandidates(organizationId, {
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      dob: new Date(dto.dob),
      phone: dto.phone,
    });

    return { data, message: 'Candidate identities retrieved successfully' };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Person.View)
  @ApiOperation({
    summary: 'Read an identity record',
    description:
      'Identity linkage and a masked identifier. Ordinary access never decrypts anything.',
  })
  @ApiOkEnvelope(PersonIdentityDto, {
    message: 'Identity retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const { organizationId } = organizationScopeOf(req.context);
    const person = await this.personService.findOne(organizationId, id);

    const data: PersonIdentityDto = {
      id: person.id,
      organizationId: person.organizationId,
      dob: person.dob,
      governmentIdType: person.sensitive?.idType ?? null,
      governmentIdMasked: maskAadhaar(person.sensitive?.aadhaarLast4),
      governmentIdErased: Boolean(person.sensitive?.erasedAt),
      mergedIntoPersonId: person.mergedIntoPersonId,
      createdAt: person.createdAt,
    };

    return { data, message: 'Identity retrieved successfully' };
  }

  @Post(':id/government-id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Person.AttachGovernmentId)
  @ApiOperation({
    summary: 'Bind a government identifier to an identity',
    description:
      'The late-arriving case: a child admitted before an identifier existed. If the ' +
      'identifier already belongs to another identity the request is refused — that is a ' +
      'conflict for a human to resolve, not something to overwrite.',
  })
  @ApiCreatedEnvelope(AttachGovernmentIdResultDto, {
    message: 'Government identifier attached successfully',
  })
  @ApiStandardErrors(400, 404, 409)
  async attachGovernmentId(
    @Param('id') id: string,
    @Body() dto: AttachGovernmentIdDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { organizationId } = organizationScopeOf(req.context);

    const result = await this.personService.attachGovernmentId(
      organizationId,
      id,
      dto.idType,
      dto.value,
    );

    return {
      data: {
        personId: result.personId,
        governmentIdMasked: maskAadhaar(result.last4),
      },
      message: 'Government identifier attached successfully',
    };
  }

  @Post('match-decisions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Person.Correct)
  @ApiOperation({
    summary: 'Record that two candidates are different people',
    description:
      'Stops the same twin warning firing at every step of every year, which is how staff ' +
      'learn to dismiss all warnings reflexively.',
  })
  @ApiCreatedEnvelope(MatchDecisionResultDto, {
    message: 'Match decision recorded successfully',
  })
  @ApiStandardErrors(400, 404)
  async recordDecision(
    @Body() dto: RecordMatchDecisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { organizationId } = organizationScopeOf(req.context);

    const data = await this.personService.recordDistinct(
      organizationId,
      dto.personAId,
      dto.personBId,
      dto.reason,
      req.userId ?? 'SYSTEM',
    );

    return { data, message: 'Match decision recorded successfully' };
  }
}
