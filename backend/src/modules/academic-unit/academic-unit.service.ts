import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  AcademicUnitCreatedEvent,
  AcademicUnitUpdatedEvent,
  AcademicUnitDeletedEvent,
} from '@/common/events';
import { CreateAcademicUnitDto } from './dto/create-academic-unit.dto';
import { UpdateAcademicUnitDto } from './dto/update-academic-unit.dto';
import { MoveAcademicUnitDto } from './dto/move-academic-unit.dto';
import { buildAcademicTree } from './utils/academic-tree.util';

@Injectable()
export class AcademicUnitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async createAcademicUnit(dto: CreateAcademicUnitDto, userId: string) {
    // Validate existence of branch, program, and academic year
    const [branch, program, academicYear] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: dto.branchId, isDeleted: false },
      }),
      this.prisma.program.findUnique({
        where: { id: dto.programId, isDeleted: false },
      }),
      this.prisma.academicYear.findUnique({
        where: { id: dto.academicYearId, isDeleted: false },
      }),
    ]);

    if (!branch) throw new NotFoundException('Branch not found');
    if (!program) throw new NotFoundException('Program not found');
    if (!academicYear) throw new NotFoundException('Academic year not found');

    let level = 0;

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.academicUnit.findUnique({
        where: { id: dto.parentId, isDeleted: false },
      });

      if (!parent)
        throw new NotFoundException(
          'Parent academic unit not found or is deleted',
        );
      if (parent.branchId !== dto.branchId)
        throw new BadRequestException('Parent belongs to a different branch');
      if (parent.programId !== dto.programId)
        throw new BadRequestException('Parent belongs to a different program');
      if (parent.academicYearId !== dto.academicYearId)
        throw new BadRequestException(
          'Parent belongs to a different academic year',
        );

      level = parent.level + 1;
    }

    // Check unique sibling name under the same parent/year
    const existingName = await this.prisma.academicUnit.findFirst({
      where: {
        academicYearId: dto.academicYearId,
        parentId: dto.parentId || null,
        name: dto.name,
        isDeleted: false,
      },
    });

    if (existingName)
      throw new ConflictException(
        `Academic unit with name ${dto.name} already exists under this parent`,
      );

    const unit = await this.prisma.academicUnit.create({
      data: {
        ...dto,
        level,
        metadata: dto.metadata || {},
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new AcademicUnitCreatedEvent({
        academicUnitId: unit.id,
        name: unit.name,
        branchId: unit.branchId,
        programId: unit.programId,
        academicYearId: unit.academicYearId,
      }),
    );

    return unit;
  }

  async getAllAcademicUnits(branchId?: string, academicYearId?: string) {
    const where: any = { isDeleted: false };
    if (branchId) where.branchId = branchId;
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.academicUnit.findMany({
      where,
      orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getAcademicUnitById(id: string) {
    const unit = await this.prisma.academicUnit.findUnique({
      where: { id, isDeleted: false },
      include: {
        parent: true,
        children: { where: { isDeleted: false } },
      },
    });

    if (!unit) throw new NotFoundException('Academic unit not found');
    return unit;
  }

  async getAcademicTree(branchId: string, academicYearId?: string) {
    const units = await this.getAllAcademicUnits(branchId, academicYearId);
    return buildAcademicTree(units);
  }

  async updateAcademicUnit(
    id: string,
    dto: UpdateAcademicUnitDto,
    userId: string,
  ) {
    const unit = await this.getAcademicUnitById(id);

    if (dto.name && dto.name !== unit.name) {
      const existingName = await this.prisma.academicUnit.findFirst({
        where: {
          academicYearId: unit.academicYearId,
          parentId: unit.parentId,
          name: dto.name,
          id: { not: id },
          isDeleted: false,
        },
      });

      if (existingName)
        throw new ConflictException(
          `Academic unit with name ${dto.name} already exists under this parent`,
        );
    }

    // Do not allow changing hierarchy fields via standard update
    delete (dto as any).branchId;
    delete (dto as any).programId;
    delete (dto as any).academicYearId;
    delete (dto as any).parentId;

    const updated = await this.prisma.academicUnit.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new AcademicUnitUpdatedEvent({
        academicUnitId: updated.id,
        name: updated.name,
      }),
    );

    return updated;
  }

  async moveAcademicUnit(id: string, dto: MoveAcademicUnitDto, userId: string) {
    const unit = await this.getAcademicUnitById(id);

    if (dto.parentId === unit.parentId) return unit;

    let newLevel = 0;

    if (dto.parentId) {
      if (dto.parentId === id)
        throw new BadRequestException(
          'Cannot set academic unit as its own parent',
        );

      const parent = await this.getAcademicUnitById(dto.parentId);

      if (parent.branchId !== unit.branchId)
        throw new BadRequestException('Parent belongs to a different branch');
      if (parent.programId !== unit.programId)
        throw new BadRequestException('Parent belongs to a different program');
      if (parent.academicYearId !== unit.academicYearId)
        throw new BadRequestException(
          'Parent belongs to a different academic year',
        );

      // Check for circular reference
      let currentParentId = parent.parentId;
      while (currentParentId) {
        if (currentParentId === id)
          throw new BadRequestException('Cannot create circular hierarchy');
        const ancestor = await this.prisma.academicUnit.findUnique({
          where: { id: currentParentId },
        });
        currentParentId = ancestor?.parentId || null;
      }

      newLevel = parent.level + 1;
    }

    // Check name uniqueness in new parent
    const existingName = await this.prisma.academicUnit.findFirst({
      where: {
        academicYearId: unit.academicYearId,
        parentId: dto.parentId || null,
        name: unit.name,
        isDeleted: false,
      },
    });

    if (existingName)
      throw new ConflictException(
        `Academic unit with name ${unit.name} already exists under the new parent`,
      );

    const updatedUnit = await this.prisma.academicUnit.update({
      where: { id },
      data: {
        parentId: dto.parentId || null,
        level: newLevel,
        updatedBy: userId,
      },
    });

    // Update levels for all descendants
    await this.updateDescendantLevels(id, newLevel);

    await this.eventBus.publish(
      new AcademicUnitUpdatedEvent({
        academicUnitId: updatedUnit.id,
        name: updatedUnit.name,
      }),
    );

    return updatedUnit;
  }

  private async updateDescendantLevels(parentId: string, parentLevel: number) {
    const children = await this.prisma.academicUnit.findMany({
      where: { parentId, isDeleted: false },
    });

    for (const child of children) {
      const newLevel = parentLevel + 1;
      await this.prisma.academicUnit.update({
        where: { id: child.id },
        data: { level: newLevel },
      });
      await this.updateDescendantLevels(child.id, newLevel);
    }
  }

  async softDeleteAcademicUnit(id: string, userId: string) {
    await this.getAcademicUnitById(id);

    const activeChildren = await this.prisma.academicUnit.count({
      where: { parentId: id, isDeleted: false },
    });

    if (activeChildren > 0) {
      throw new BadRequestException(
        'Cannot delete academic unit with active children',
      );
    }

    const deleted = await this.prisma.academicUnit.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new AcademicUnitDeletedEvent({
        academicUnitId: deleted.id,
      }),
    );

    return deleted;
  }

  async toggleAcademicUnitStatus(id: string, userId: string) {
    const unit = await this.getAcademicUnitById(id);
    const updated = await this.prisma.academicUnit.update({
      where: { id },
      data: {
        isActive: !unit.isActive,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new AcademicUnitUpdatedEvent({
        academicUnitId: updated.id,
        name: updated.name,
      }),
    );

    return updated;
  }
}
