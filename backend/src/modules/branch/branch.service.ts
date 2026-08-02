import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  BranchCreatedEvent,
  BranchUpdatedEvent,
  BranchDeletedEvent,
} from '@/common/events';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RequestContextService } from '@/common/logger/request-context.service';
import { RoleType } from '@/generated/client';

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly requestContext: RequestContextService,
  ) {}

  async createBranch(dto: CreateBranchDto, userId?: string) {
    // Validate organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organization with ID ${dto.organizationId} not found`,
      );
    }

    const code = dto.code.trim().toLowerCase();

    // Ensure unique code
    const existing = await this.prisma.branch.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException('Branch with this code already exists');
    }

    // Ensure unique registration number if provided
    if (dto.registrationNumber) {
      const existingReg = await this.prisma.branch.findUnique({
        where: { registrationNumber: dto.registrationNumber },
      });
      if (existingReg) {
        throw new ConflictException(
          'Branch with this registration number already exists',
        );
      }
    }

    const branch = await this.prisma.branch.create({
      data: {
        ...dto,
        code,
        institutionType: dto.institutionType,
        affiliationType: dto.affiliationType,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new BranchCreatedEvent({
        branchId: branch.id,
        name: branch.name,
        code: branch.code,
      }),
    );

    return branch;
  }

  /**
   * Lists branches visible in the caller's scope.
   *
   * Scoped by the resolved organization for every role except SUPER_ADMIN.
   * This previously returned every branch in the system: `GET /branches`
   * requires only `settings.view`, which ORG_ADMIN holds, so an administrator
   * of one organization could enumerate every other tenant's branches.
   */
  async getAllBranches() {
    const context = this.requestContext.getContext();
    const isSuperAdmin = context?.role === RoleType.SUPER_ADMIN;
    const organizationId = context?.organizationId ?? null;

    return this.prisma.branch.findMany({
      where: {
        isDeleted: false,
        ...(isSuperAdmin || !organizationId ? {} : { organizationId }),
      },
      include: { organization: true },
    });
  }

  async getBranchesByOrganization(orgId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId: orgId, isDeleted: false },
    });
  }

  async getBranchById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!branch || branch.isDeleted) {
      throw new NotFoundException('Branch not found or has been deleted');
    }

    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto, userId?: string) {
    const branch = await this.getBranchById(id);

    if (dto.code) {
      const code = dto.code.trim().toLowerCase();
      if (code !== branch.code) {
        const existing = await this.prisma.branch.findUnique({
          where: { code },
        });
        if (existing) {
          throw new ConflictException('Branch with this code already exists');
        }
      }
    }

    if (
      dto.registrationNumber &&
      dto.registrationNumber !== branch.registrationNumber
    ) {
      const existingReg = await this.prisma.branch.findUnique({
        where: { registrationNumber: dto.registrationNumber },
      });
      if (existingReg) {
        throw new ConflictException(
          'Branch with this registration number already exists',
        );
      }
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...dto,
        institutionType: dto.institutionType,
        affiliationType: dto.affiliationType,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new BranchUpdatedEvent({
        branchId: updated.id,
        name: updated.name,
        code: updated.code,
      }),
    );

    return updated;
  }

  async softDeleteBranch(id: string, userId?: string) {
    await this.getBranchById(id);

    const deleted = await this.prisma.branch.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new BranchDeletedEvent({
        branchId: deleted.id,
      }),
    );

    return deleted;
  }

  async toggleBranchStatus(id: string, userId?: string) {
    const branch = await this.getBranchById(id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        isActive: !branch.isActive,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new BranchUpdatedEvent({
        branchId: updated.id,
        name: updated.name,
        code: updated.code,
      }),
    );

    return updated;
  }
}
