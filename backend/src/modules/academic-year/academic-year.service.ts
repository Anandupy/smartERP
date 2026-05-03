import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.academicYear.create({
      data: {
        ...dto,
        startDate: start,
        endDate: end,
        isActive: isFirst,
        isSelected: isFirst,
        createdBy: creatorId,
      },
    });
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

      return this.prisma.academicYear.update({
        where: { id },
        data: {
          ...dto,
          startDate: start,
          endDate: end,
          updatedBy: updaterId,
        },
      });
    }

    return this.prisma.academicYear.update({
      where: { id },
      data: { ...dto, updatedBy: updaterId },
    });
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

    return { message: 'Academic year selected successfully' };
  }

  async lock(id: string) {
    await this.findById(id);
    return this.prisma.academicYear.update({
      where: { id },
      data: { isLocked: true },
    });
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

    return this.prisma.academicYear.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  private async findById(id: string) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id, isDeleted: false },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    return year;
  }
}
