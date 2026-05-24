import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { Program } from '@prisma/client';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  async createProgram(dto: CreateProgramDto, userId: string) {
    // 1. Validate branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // 2. Validate parent (if given)
    if (dto.parentId) {
      const parent = await this.prisma.program.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.branchId !== dto.branchId) {
        throw new BadRequestException(
          'Parent program must belong to the same branch',
        );
      }
    }

    // 3. Normalize fields
    const name = dto.name.trim();
    const medium = dto.medium?.trim();
    const stream = dto.stream?.trim();

    // 4. Check for duplicate
    const existing = await this.prisma.program.findFirst({
      where: {
        branchId: dto.branchId,
        name: { equals: name, mode: 'insensitive' },
        medium: medium ? { equals: medium, mode: 'insensitive' } : null,
        stream: stream ? { equals: stream, mode: 'insensitive' } : null,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException('Program already exists in this branch');
    }

    return this.prisma.program.create({
      data: {
        ...dto,
        name,
        medium,
        stream,
        createdBy: userId,
      },
    });
  }

  async getProgramsByBranch(branchId: string) {
    return this.prisma.program.findMany({
      where: { branchId, isDeleted: false },
      include: { parent: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProgramTree(branchId: string) {
    const allPrograms = await this.prisma.program.findMany({
      where: { branchId, isDeleted: false },
    });

    // Build tree
    const buildTree = (parentId: string | null = null): any[] => {
      return allPrograms
        .filter((p) => p.parentId === parentId)
        .map((p) => ({
          ...p,
          children: buildTree(p.id),
        }));
    };

    return buildTree();
  }

  async updateProgram(id: string, dto: UpdateProgramDto, userId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
    });

    if (!program || program.isDeleted) {
      throw new NotFoundException('Program not found');
    }

    // Validate hierarchy
    if (dto.parentId && dto.parentId !== program.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Program cannot be its own parent');
      }

      const parent = await this.prisma.program.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent || parent.branchId !== program.branchId) {
        throw new BadRequestException(
          'Parent program must belong to the same branch',
        );
      }

      // Circularity check
      let currentParentId: string | null = dto.parentId;
      const visited = new Set<string>();
      while (currentParentId) {
        if (currentParentId === id || visited.has(currentParentId)) {
          throw new BadRequestException('Circular hierarchy detected');
        }
        visited.add(currentParentId);
        const parentRecord: Program | null =
          await this.prisma.program.findUnique({
            where: { id: currentParentId },
          });
        currentParentId = parentRecord?.parentId || null;
      }
    }

    return this.prisma.program.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  async softDeleteProgram(id: string, userId: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program || program.isDeleted) {
      throw new NotFoundException('Program not found');
    }

    // Optional: Check if it has active children
    const children = await this.prisma.program.count({
      where: { parentId: id, isDeleted: false },
    });
    if (children > 0) {
      throw new BadRequestException(
        'Cannot delete program with active sub-programs',
      );
    }

    return this.prisma.program.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedBy: userId,
      },
    });
  }

  async toggleProgramStatus(id: string, userId: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program || program.isDeleted) {
      throw new NotFoundException('Program not found');
    }

    return this.prisma.program.update({
      where: { id },
      data: {
        isActive: !program.isActive,
        updatedBy: userId,
      },
    });
  }

  async findById(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: { branch: true, parent: true },
    });
    if (!program || program.isDeleted) {
      throw new NotFoundException('Program not found');
    }
    return program;
  }
}
