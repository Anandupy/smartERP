import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  REQUIRE_BRANCH_KEY,
  BranchOptions,
} from '../decorators/branch.decorator';
import { REQUIRE_ACADEMIC_YEAR_KEY } from '../decorators/academic-year.decorator';
import { UserRole } from '../enums/role.enum';
import { AuthenticatedRequest } from '../logger/request-context.middleware';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@Injectable()
export class BranchGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    // Resolve target branchId from context, headers, query, or user
    const rawHeaderBranchId =
      (request.headers['x-branch-id'] as string) ||
      (request.headers['X-Branch-Id'] as string);

    const rawBranchId =
      request.context?.branchId ||
      rawHeaderBranchId ||
      (request.query?.branchId as string) ||
      request.user?.branchId;

    const branchId = rawBranchId ? rawBranchId.trim() : null;

    if (!branchId) {
      if (branchOptions?.optional) {
        return true;
      }
      throw new BadRequestException(
        'Branch context (x-branch-id header) is required',
      );
    }

    if (!UUID_REGEX.test(branchId)) {
      throw new BadRequestException(
        'Invalid Branch ID format. Must be a valid UUID',
      );
    }

    // Verify Branch existence in DB
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.isDeleted || !branch.isActive) {
      throw new NotFoundException('Branch not found or inactive');
    }

    // Tenant / Organization Boundary Enforcement
    const userRole = request.context?.role || request.user?.role;
    const userOrgId =
      request.context?.organizationId || request.user?.organizationId;

    if (
      userRole &&
      userRole !== UserRole.SUPER_ADMIN &&
      userOrgId &&
      branch.organizationId !== userOrgId
    ) {
      throw new ForbiddenException(
        'Access to branch outside organization is forbidden',
      );
    }

    // Attach to context
    if (!request.context) {
      request.context = {
        requestId: request.requestId || 'unknown',
        branchId: branch.id,
        academicYearId: null,
        organizationId: branch.organizationId,
        userId: request.user?.id || null,
        role: userRole || null,
      };
    } else {
      request.context.branchId = branch.id;
      request.context.organizationId = branch.organizationId;
    }

    request.context.branch = {
      id: branch.id,
      organizationId: branch.organizationId,
      name: branch.name,
      code: branch.code,
      institutionType: branch.institutionType,
      isActive: branch.isActive,
      isDeleted: branch.isDeleted,
    };

    return true;
  }
}
