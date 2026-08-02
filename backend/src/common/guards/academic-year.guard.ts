import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_ACADEMIC_YEAR_KEY,
  AcademicYearOptions,
} from '../decorators/academic-year.decorator';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

/**
 * Asserts that an academic year scope is present for routes declaring
 * `@RequireAcademicYear()`.
 *
 * The academic year — including the fallback to the branch's selected or active
 * year when `x-academic-year-id` is omitted — is resolved and validated once by
 * `ExecutionContextGuard`. This guard only checks the outcome.
 */
@Injectable()
export class AcademicYearGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<AcademicYearOptions>(
      REQUIRE_ACADEMIC_YEAR_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint is not decorated with @RequireAcademicYear(), pass through
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.context?.branchId) {
      throw new BadRequestException(
        'Branch context (x-branch-id header) is required',
      );
    }

    if (request.context.academicYearId) {
      return true;
    }

    if (options.optional) {
      return true;
    }

    throw new BadRequestException('x-academic-year-id header is required');
  }
}
