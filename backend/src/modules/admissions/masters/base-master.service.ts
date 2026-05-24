import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class BaseMasterService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string,
  ) {}

  async create(
    dto: any,
    organizationId: string | null,
    branchId: string | null,
  ) {
    const { code, name } = dto;

    // Check unique code (case-insensitive)
    const existingCode = await (this.prisma as any)[this.modelName].findFirst({
      where: {
        organizationId,
        branchId,
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existingCode) {
      throw new BadRequestException(
        `Master with code '${code}' already exists in this scope`,
      );
    }

    // Check unique name (case-insensitive)
    const existingName = await (this.prisma as any)[this.modelName].findFirst({
      where: {
        organizationId,
        branchId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existingName) {
      throw new BadRequestException(
        `Master with name '${name}' already exists in this scope`,
      );
    }

    return (this.prisma as any)[this.modelName].create({
      data: {
        ...dto,
        organizationId,
        branchId,
      },
    });
  }

  async findAll(
    organizationId: string | null,
    branchId: string | null,
    includeInactive = false,
  ) {
    return (this.prisma as any)[this.modelName].findMany({
      where: {
        OR: [
          { organizationId, branchId },
          { organizationId: null, branchId: null },
          ...(organizationId ? [{ organizationId, branchId: null }] : []),
        ],
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const record = await (this.prisma as any)[this.modelName].findFirst({
      where: { id, deletedAt: null },
    });
    if (!record) {
      throw new NotFoundException(`Master record not found`);
    }
    return record;
  }

  async update(
    id: string,
    dto: any,
    organizationId: string | null,
    branchId: string | null,
  ) {
    await this.findOne(id);

    if (dto.code) {
      const existingCode = await (this.prisma as any)[this.modelName].findFirst(
        {
          where: {
            id: { not: id },
            organizationId,
            branchId,
            code: { equals: dto.code, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      );
      if (existingCode) {
        throw new BadRequestException(
          `Master with code '${dto.code}' already exists in this scope`,
        );
      }
    }

    if (dto.name) {
      const existingName = await (this.prisma as any)[this.modelName].findFirst(
        {
          where: {
            id: { not: id },
            organizationId,
            branchId,
            name: { equals: dto.name, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      );
      if (existingName) {
        throw new BadRequestException(
          `Master with name '${dto.name}' already exists in this scope`,
        );
      }
    }

    return (this.prisma as any)[this.modelName].update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return (this.prisma as any)[this.modelName].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
