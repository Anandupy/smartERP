import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatus } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(dto: CreateOrganizationDto, userId?: string) {
    const normalizedCode = dto.code.toLowerCase().trim();

    const existingOrg = await this.prisma.organization.findUnique({
      where: { code: normalizedCode },
    });

    if (existingOrg) {
      throw new ConflictException(
        `Organization with code ${normalizedCode} already exists`,
      );
    }

    return this.prisma.organization.create({
      data: {
        ...dto,
        code: normalizedCode,
        status: dto.status || OrganizationStatus.ACTIVE,
        createdBy: userId,
      },
    });
  }

  async getAllOrganizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrganizationById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return org;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    userId?: string,
  ) {
    await this.getOrganizationById(id);

    if (dto.code) {
      const normalizedCode = dto.code.toLowerCase().trim();
      const existingOrg = await this.prisma.organization.findFirst({
        where: { code: normalizedCode, NOT: { id } },
      });

      if (existingOrg) {
        throw new ConflictException(
          `Organization with code ${normalizedCode} already exists`,
        );
      }
      dto.code = normalizedCode;
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  async softDeleteOrganization(id: string, userId?: string) {
    await this.getOrganizationById(id);

    return this.prisma.organization.update({
      where: { id },
      data: {
        status: OrganizationStatus.INACTIVE,
        updatedBy: userId,
      },
    });
  }
}
