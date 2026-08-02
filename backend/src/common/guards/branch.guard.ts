import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_BRANCH_KEY,
  BranchOptions,
} from '../decorators/branch.decorator';
import { REQUIRE_ACADEMIC_YEAR_KEY } from '../decorators/academic-year.decorator';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Asserts that a branch scope is present for routes declaring `@RequireBranch()`
 * or `@RequireAcademicYear()`.
 *
 * Resolution, validation and tenant-boundary enforcement all happen once, in
 * `ExecutionContextGuard` / `ContextValidatorService`. This guard only checks
 * the outcome, so a request never hits the database twice for the same branch
 * and can never see a branch that context resolution rejected.
 */
@Injectable()
export class BranchGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const branchOptions = this.reflector.getAllAndOverride<BranchOptions>(
      REQUIRE_BRANCH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const academicYearOptions = this.reflector.getAllAndOverride<unknown>(
      REQUIRE_ACADEMIC_YEAR_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pass through if neither @RequireBranch() nor @RequireAcademicYear() is present
    if (!branchOptions && !academicYearOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.context?.branchId) {
      return true;
    }

    if (branchOptions?.optional) {
      return true;
    }

    throw new BadRequestException(
      'Branch context (x-branch-id header) is required',
    );
  }
}
