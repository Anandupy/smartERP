import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  AcademicYearCreatedEvent,
  AcademicYearUpdatedEvent,
  AcademicYearDeletedEvent,
} from '@/common/events';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async create(dto: CreateAcademicYearDto, creatorId?: string) {
    const { branchId, startDate, endDate } = dto;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new BadRequestException('Invalid date range');
    }

    // Check branch existence
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Overlap check
    const overlap = await this.prisma.academicYear.findFirst({
      where: {
        branchId,
        isDeleted: false,
        OR: [
          {
            AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
          },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestException(
        'Academic year already overlaps with existing year',
      );
    }

    // Check if first year
    const count = await this.prisma.academicYear.count({
      where: { branchId, isDeleted: false },
    });
    const isFirst = count === 0;

    const year = await this.prisma.academicYear.create({
      data: {
        ...dto,
        startDate: start,
        endDate: end,
        isActive: isFirst,
        isSelected: isFirst,
        createdBy: creatorId,
      },
    });

    await this.eventBus.publish(
      new AcademicYearCreatedEvent({
        academicYearId: year.id,
        name: year.name,
        branchId: year.branchId,
      }),
    );

    return year;
  }

  async findAll(branchId: string) {
    return this.prisma.academicYear.findMany({
      where: { branchId, isDeleted: false },
      orderBy: { startDate: 'asc' },
    });
  }

  async findCurrent(branchId: string) {
    return this.prisma.academicYear.findFirst({
      where: { branchId, isSelected: true, isDeleted: false },
    });
  }

  async update(id: string, dto: UpdateAcademicYearDto, updaterId?: string) {
    const year = await this.findById(id);

    if (year.isLocked) {
      throw new ForbiddenException(
        'Academic year is locked and cannot be modified',
      );
    }

    let updated;

    // If dates changed, check overlap
    if (dto.startDate || dto.endDate) {
      const start = dto.startDate ? new Date(dto.startDate) : year.startDate;
      const end = dto.endDate ? new Date(dto.endDate) : year.endDate;

      if (start >= end) {
        throw new BadRequestException('Invalid date range');
      }

      const overlap = await this.prisma.academicYear.findFirst({
        where: {
          branchId: year.branchId,
          id: { not: id },
          isDeleted: false,
          OR: [
            {
              AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
            },
          ],
        },
      });

      if (overlap) {
        throw new BadRequestException(
          'Academic year already overlaps with existing year',
        );
      }

      updated = await this.prisma.academicYear.update({
        where: { id },
        data: {
          ...dto,
          startDate: start,
          endDate: end,
          updatedBy: updaterId,
        },
      });
    } else {
      updated = await this.prisma.academicYear.update({
        where: { id },
        data: { ...dto, updatedBy: updaterId },
      });
    }

    await this.eventBus.publish(
      new AcademicYearUpdatedEvent({
        academicYearId: updated.id,
        name: updated.name,
      }),
    );

    return updated;
  }

  async activate(id: string) {
    const year = await this.findById(id);

    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({
        where: { branchId: year.branchId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.academicYear.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    await this.eventBus.publish(
      new AcademicYearUpdatedEvent({
        academicYearId: year.id,
        name: year.name,
      }),
    );

    return { message: 'Academic year activated successfully' };
  }

  async select(id: string) {
    const year = await this.findById(id);

    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({
        where: { branchId: year.branchId, isSelected: true },
        data: { isSelected: false },
      }),
      this.prisma.academicYear.update({
        where: { id },
        data: { isSelected: true },
      }),
    ]);

    await this.eventBus.publish(
      new AcademicYearUpdatedEvent({
        academicYearId: year.id,
        name: year.name,
      }),
    );

    return { message: 'Academic year selected successfully' };
  }

  async lock(id: string) {
    const year = await this.findById(id);
    const updated = await this.prisma.academicYear.update({
      where: { id },
      data: { isLocked: true },
    });

    await this.eventBus.publish(
      new AcademicYearUpdatedEvent({
        academicYearId: year.id,
        name: year.name,
      }),
    );

    return updated;
  }

  async softDelete(id: string) {
    const year = await this.findById(id);

    if (year.isLocked) {
      throw new ForbiddenException(
        'Academic year is locked and cannot be modified',
      );
    }

    if (year.isSelected) {
      throw new BadRequestException('Cannot delete selected academic year');
    }

    const deleted = await this.prisma.academicYear.update({
      where: { id },
      data: { isDeleted: true },
    });

    await this.eventBus.publish(
      new AcademicYearDeletedEvent({
        academicYearId: deleted.id,
      }),
    );

    return deleted;
  }

  /**
   * Reads one academic year.
   *
   * Public because `GET /academic-years/:id` needs it. Without that endpoint a
   * client could only reach a year through its branch's list, which made every
   * detail view depend on an active branch and left no way to refetch a single
   * record.
   *
   * Soft-deleted years are not found, matching the list.
   */
  async findById(id: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id, isDeleted: false },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    return year;
  }
}
