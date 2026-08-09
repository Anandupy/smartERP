import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoleType, StudentStatus } from '@/generated/client';
import { StudentService } from './student.service';
import {
  CorrectStudentDemographicsDto,
  LookupStudentByCodeDto,
  SearchStudentsDto,
} from './dto/student.dto';
import {
  StudentCrossBranchSummaryDto,
  StudentDetailDto,
  StudentListItemDto,
} from './dto/student-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RequirePermission } from '@/common/decorators/permission.decorator';
import { RequireBranch } from '@/common/decorators/branch.decorator';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { UserRole } from '@/common/enums/role.enum';
import {
  ApiOkEnvelope,
  ApiPaginatedItemsEnvelope,
  ApiStandardErrors,
} from '@/common/http/api-envelope-response.decorator';
import { resourceScopeOf } from '@/common/scope/resource-scope';
import { AuthenticatedRequest } from '@/common/logger/request-context.types';
import { AuthorizationService } from '@/modules/authorization/authorization.service';

/**
 * Narrow an out-of-branch match to what the caller is entitled to see.
 *
 * A function with a declared return type rather than an inline cast: a cast
 * would let a field added to the source silently start appearing in the
 * reduced projection, which is the opposite of what the projection is for.
 */
function reduceToCrossBranchSummary(student: {
  id: string;
  studentCode: string;
  displayName: string;
  branchId: string;
  status: StudentStatus;
}): StudentCrossBranchSummaryDto {
  return {
    id: student.id,
    studentCode: student.studentCode,
    displayName: student.displayName,
    branchId: student.branchId,
    status: student.status,
  };
}

/**
 * The permanent learner identity.
 *
 * ## What is deliberately absent
 *
 * **No `POST`.** A Student is born from `admit()` (Phase 5) or the migration
 * importer. An ordinary create endpoint would let staff mint identities with no
 * application, no admission and no placement behind them.
 *
 * **No `DELETE`.** Leaving is a lifecycle status; deletion is not a lifecycle
 * operation, and archival is a write lock rather than a disappearance.
 *
 * **No lifecycle, transfer, promotion or readmission routes.** Those operations
 * each write more than a Student row, and each belongs to the phase that owns
 * what else they write.
 *
 * ## Identifiers
 *
 * The path takes the UUID; the code is a query parameter on a lookup route.
 * That is not cosmetic — the code has a narrow correction path (§13.4), and a
 * correctable value must not be the thing a resource is addressed by.
 */
@ApiTags('Identity — Student')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-branch-id',
  required: true,
  description: 'Target Branch UUID. The default search and read boundary.',
})
@RequireBranch()
@Controller('students')
export class StudentController {
  constructor(
    private readonly students: StudentService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Student.Search)
  @ApiOperation({
    summary: 'Search students',
    description:
      'One free-text term, interpreted by shape. Branch-scoped by default: a student ' +
      'in another branch is simply absent from the results rather than refused, because ' +
      'a refusal would confirm the record exists. `student.view.organization` widens the ' +
      'search, and out-of-branch matches come back as a reduced summary.',
  })
  @ApiPaginatedItemsEnvelope(StudentListItemDto, {
    message: 'Students retrieved successfully',
  })
  @ApiStandardErrors()
  async search(
    @Query() query: SearchStudentsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = resourceScopeOf(req.context);
    const organizationWide =
      query.organizationWide === true &&
      (await this.canSeeWholeOrganization(req));

    const result = await this.students.search(
      {
        q: query.q,
        dob: query.dob ? new Date(query.dob) : undefined,
        status: query.status,
        includeInactive: query.includeInactive,
        organizationWide,
        page: query.page,
        limit: query.limit,
      },
      scope,
    );

    // A match outside the caller's branch answers "does this code belong to one
    // of ours, and where?" — which is the actual reason to search a code you do
    // not own — and stops there. Contact details stay with the branch that
    // holds the record.
    const items: Array<StudentListItemDto | StudentCrossBranchSummaryDto> =
      result.items.map((student) =>
        student.branchId === scope.branchId
          ? student
          : reduceToCrossBranchSummary(student),
      );

    return {
      data: { items, meta: result.meta },
      message: 'Students retrieved successfully',
    };
  }

  @Get('lookup')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Student.Search)
  @ApiOperation({
    summary: 'Resolve a student code',
    description:
      'Case-insensitive. Declared before `:studentId` so a literal path segment is not ' +
      'captured as an identifier.',
  })
  @ApiOkEnvelope(StudentDetailDto, {
    message: 'Student retrieved successfully',
  })
  @ApiStandardErrors(404)
  async lookupByCode(
    @Query() query: LookupStudentByCodeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationWide =
      query.organizationWide === true &&
      (await this.canSeeWholeOrganization(req));

    const data = await this.students.findByCode(
      query.code,
      resourceScopeOf(req.context),
      { organizationWide },
    );

    return { data, message: 'Student retrieved successfully' };
  }

  @Get(':studentId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.BRANCH_ADMIN,
    UserRole.STAFF,
  )
  @RequirePermission(PERMISSIONS.Student.View)
  @ApiOperation({
    summary: 'Read a student',
    description:
      'Identity and the current official demographics. No government identifier in any ' +
      'form — reaching that is a Person operation with its own permission.',
  })
  @ApiOkEnvelope(StudentDetailDto, {
    message: 'Student retrieved successfully',
  })
  @ApiStandardErrors(404)
  async findOne(
    @Param('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationWide = await this.canSeeWholeOrganization(req);

    const data = await this.students.findById(
      studentId,
      resourceScopeOf(req.context),
      { organizationWide },
    );

    return { data, message: 'Student retrieved successfully' };
  }

  @Patch(':studentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.BRANCH_ADMIN)
  @RequirePermission(PERMISSIONS.Student.Update)
  @ApiOperation({
    summary: "Correct the institution's current official record",
    description:
      'Identity fields are unreachable from here, and this does not touch the ' +
      'application the student came from — that record is a frozen snapshot of what was ' +
      'declared on a date, and a later correction must not rewrite it.',
  })
  @ApiOkEnvelope(StudentDetailDto, {
    message: 'Student record corrected successfully',
  })
  @ApiStandardErrors(400, 404, 409)
  async correct(
    @Param('studentId') studentId: string,
    @Body() dto: CorrectStudentDemographicsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.students.correctDemographics(
      studentId,
      { ...dto, dob: dto.dob ? new Date(dto.dob) : undefined },
      resourceScopeOf(req.context),
      req.userId ?? undefined,
    );

    return { data, message: 'Student record corrected successfully' };
  }

  /**
   * Whether this caller may look past their branch.
   *
   * Checked rather than inferred from the role: `if (role === ORG_ADMIN)`
   * scattered through controllers is a second authorization system that drifts
   * from the real one the first time somebody grants the permission directly.
   */
  private async canSeeWholeOrganization(
    req: AuthenticatedRequest,
  ): Promise<boolean> {
    if (!req.userId || !req.context.role) return false;

    return this.authorization.hasPermission(
      req.userId,
      req.context.role as RoleType,
      PERMISSIONS.Student.ViewOrganization,
    );
  }
}
