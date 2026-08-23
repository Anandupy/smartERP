import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { UserCreatedEvent, UserUpdatedEvent } from '@/common/events';
import { PasswordService } from '@/common/services/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RoleType } from '@/generated/client';
import { UserRole } from '@/common/enums/role.enum';
import { assertOrganizationInScope } from '@/common/scope/resource-scope';
import type { RequestContext } from '@/common/logger/request-context.types';

/**
 * Roles a caller in a given role may assign to a new or updated user.
 *
 * SUPER_ADMIN is platform-level and may assign anything, including further
 * SUPER_ADMIN and ORG_ADMIN accounts — this is the only path that provisions
 * an ORG_ADMIN (see `docs/core/workspace-bootstrap.md`). ORG_ADMIN provisions
 * the roles that operate inside their own organization; it may not create a
 * peer ORG_ADMIN or escalate to SUPER_ADMIN.
 */
const ASSIGNABLE_ROLES: Partial<Record<UserRole, RoleType[]>> = {
  [UserRole.SUPER_ADMIN]: [
    RoleType.SUPER_ADMIN,
    RoleType.ORG_ADMIN,
    RoleType.BRANCH_ADMIN,
    RoleType.STAFF,
    RoleType.STUDENT,
    RoleType.PARENT,
  ],
  [UserRole.ORG_ADMIN]: [
    RoleType.BRANCH_ADMIN,
    RoleType.STAFF,
    RoleType.STUDENT,
    RoleType.PARENT,
  ],
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly eventBus: EventBus,
  ) {}

  async createUser(
    dto: CreateUserDto,
    creatorId?: string,
    context?: RequestContext,
  ) {
    const actorRole = context?.role as UserRole | undefined;

    // No actor means an internal/system caller (seeder, scripts) — trusted by
    // construction. An authenticated HTTP caller always carries a role.
    if (actorRole) {
      this.assertCanAssignRole(actorRole, dto.role);
    }

    let organizationId = dto.organizationId ?? null;

    // ORG_ADMIN provisions users inside their own organization only. Default
    // to it when the caller omitted the field, and refuse a mismatched one —
    // the same rule `assertOrganizationInScope` enforces for Branch and
    // Academic Year creation.
    if (actorRole && actorRole !== UserRole.SUPER_ADMIN) {
      organizationId = context?.organizationId ?? null;
      if (dto.organizationId) {
        assertOrganizationInScope(context, dto.organizationId);
      }
    }

    if (organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    const branchId = dto.branchId ?? null;
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, organizationId: true },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (organizationId && branch.organizationId !== organizationId) {
        throw new ForbiddenException({
          error: 'ORGANIZATION_SCOPE_VIOLATION',
          message: 'This branch does not belong to the target organization.',
        });
      }
      // A branch always implies its own organization, even when the caller
      // (SUPER_ADMIN) did not name one explicitly.
      organizationId = organizationId ?? branch.organizationId;
    }

    const { password, ...rest } = dto;
    const userData = { ...rest, organizationId, branchId };

    // Check uniqueness
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username },
          { phone: dto.phone },
        ],
      },
    });

    if (existing) {
      if (existing.email === dto.email)
        throw new ConflictException('Email already exists');
      if (existing.username === dto.username)
        throw new ConflictException('Username already exists');
      if (existing.phone === dto.phone)
        throw new ConflictException('Phone number already exists');
    }

    const passwordHash = await this.passwordService.hash(password);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        createdBy: creatorId,
        updatedBy: creatorId,
      },
      select: this.userSelect(),
    });

    await this.eventBus.publish(
      new UserCreatedEvent({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }),
    );

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect(),
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Reads a user, then confirms it is inside the caller's authorized scope.
   *
   * `GET /auth/me` and internal callers use `findById` directly to read the
   * caller's own record, unrestricted by tenant scope. This wrapper is for
   * `GET /users/:id`, where an ORG_ADMIN or BRANCH_ADMIN could otherwise
   * fetch any user in the system by guessing an id.
   */
  async findByIdForActor(id: string, context?: RequestContext) {
    const user = await this.findById(id);
    assertOrganizationInScope(context, user.organizationId);
    return user;
  }

  async findByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
          { phone: identifier },
        ],
      },
    });
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    updaterId?: string,
    context?: RequestContext,
  ) {
    const target = await this.findById(id);
    assertOrganizationInScope(context, target.organizationId);

    const actorRole = context?.role as UserRole | undefined;

    if (dto.role && actorRole) {
      this.assertCanAssignRole(actorRole, dto.role);
    }

    if (dto.organizationId) {
      // An ORG_ADMIN may not move a user to a different organization.
      assertOrganizationInScope(context, dto.organizationId);

      const organization = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
        select: { id: true },
      });
      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.branchId },
        select: { id: true, organizationId: true },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      const resultingOrgId = dto.organizationId ?? target.organizationId;
      if (resultingOrgId && branch.organizationId !== resultingOrgId) {
        throw new ForbiddenException({
          error: 'ORGANIZATION_SCOPE_VIOLATION',
          message: 'This branch does not belong to the target organization.',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: updaterId,
      },
      select: this.userSelect(),
    });

    await this.eventBus.publish(
      new UserUpdatedEvent({
        userId: updated.id,
        fullName: updated.fullName,
        role: updated.role,
      }),
    );

    return updated;
  }

  /**
   * Refuses a role assignment the caller's own role is not permitted to make.
   *
   * Without this, `POST /v1/users` allows any caller reachable by its
   * `@Roles(SUPER_ADMIN, ORG_ADMIN)` guard to set `role` to anything the DTO
   * accepts — including ORG_ADMIN creating another ORG_ADMIN or escalating to
   * SUPER_ADMIN.
   */
  private assertCanAssignRole(actorRole: UserRole, targetRole: RoleType) {
    const allowed = ASSIGNABLE_ROLES[actorRole] ?? [];
    if (!allowed.includes(targetRole)) {
      throw new ForbiddenException({
        error: 'ROLE_ASSIGNMENT_FORBIDDEN',
        message: `A ${actorRole} may not assign the ${targetRole} role.`,
      });
    }
  }

  private userSelect() {
    return {
      id: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      role: true,
      organizationId: true,
      branchId: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
