import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  REQUIRE_ACADEMIC_YEAR_KEY,
  AcademicYearOptions,
} from '../decorators/academic-year.decorator';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@Injectable()
export class AcademicYearGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<AcademicYearOptions>(
      REQUIRE_ACADEMIC_YEAR_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint is not decorated with @RequireAcademicYear(), pass through
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Header extraction
    const rawHeaderAyId =
      (request.headers['x-academic-year-id'] as string) ||
      (request.headers['X-Academic-Year-Id'] as string);
    const headerAyId = rawHeaderAyId ? rawHeaderAyId.trim() : null;

    // Resolve target branchId
    const rawBranchId =
      request.context?.branchId ||
      (request.headers['x-branch-id'] as string) ||
      (request.headers['X-Branch-Id'] as string) ||
      (request.query?.branchId as string) ||
      request.user?.branchId;

    const branchId = rawBranchId ? rawBranchId.trim() : null;

    if (!branchId) {
      throw new BadRequestException(
        'Branch context (x-branch-id header) is required',
      );
    }

    if (!UUID_REGEX.test(branchId)) {
      throw new BadRequestException(
        'Invalid Branch ID format. Must be a valid UUID',
      );
    }

    // Verify branch existence
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.isDeleted || !branch.isActive) {
      throw new NotFoundException('Branch not found or inactive');
    }

    let academicYear = null;

    if (headerAyId) {
      if (!UUID_REGEX.test(headerAyId)) {
        throw new BadRequestException(
          'Invalid Academic Year ID format. Must be a valid UUID',
        );
      }

      // Check if AY exists
      const ayRecord = await this.prisma.academicYear.findUnique({
        where: { id: headerAyId },
      });

      if (!ayRecord || ayRecord.isDeleted) {
        throw new NotFoundException('Academic year not found');
      }

      if (ayRecord.branchId !== branchId) {
        throw new BadRequestException(
          'Academic year does not belong to the specified branch',
        );
      }

      academicYear = ayRecord;
    } else {
      // Missing header scenario
      if (options.allowFallback) {
        // Try finding selected academic year first, then active
        academicYear = await this.prisma.academicYear.findFirst({
          where: { branchId, isSelected: true, isDeleted: false },
        });

        if (!academicYear) {
          academicYear = await this.prisma.academicYear.findFirst({
            where: { branchId, isActive: true, isDeleted: false },
          });
        }
      }

      if (!academicYear && !options.optional) {
        throw new BadRequestException(
          'x-academic-year-id header is required',
        );
      }
    }

    // Attach to context if resolved
    if (academicYear) {
      if (!request.context) {
        request.context = {
          requestId: request.requestId || 'unknown',
          branchId,
          academicYearId: academicYear.id,
          organizationId: null,
          userId: null,
          role: null,
        };
      }
      request.context.academicYearId = academicYear.id;
      request.context.branchId = branchId;
      request.context.academicYear = {
        id: academicYear.id,
        branchId: academicYear.branchId,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: academicYear.isActive,
        isSelected: academicYear.isSelected,
        isLocked: academicYear.isLocked,
      };
    }

    return true;
  }
}
