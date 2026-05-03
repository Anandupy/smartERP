import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.branch.create({
      data: {
        ...dto,
        code,
        institutionType: dto.institutionType as any,
        affiliationType: dto.affiliationType as any,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async getAllBranches() {
    return this.prisma.branch.findMany({
      where: { isDeleted: false },
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

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...dto,
        institutionType: dto.institutionType as any,
        affiliationType: dto.affiliationType as any,
        updatedBy: userId,
      },
    });
  }

  async softDeleteBranch(id: string, userId?: string) {
    await this.getBranchById(id);

    return this.prisma.branch.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        updatedBy: userId,
      },
    });
  }

  async toggleBranchStatus(id: string, userId?: string) {
    const branch = await this.getBranchById(id);

    return this.prisma.branch.update({
      where: { id },
      data: {
        isActive: !branch.isActive,
        updatedBy: userId,
      },
    });
  }
}
