import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { NumberingConfigCreatedEvent } from '@/common/events';
import { CreateNumberSequenceConfigDto } from './dto/numbering.dto';

@Injectable()
export class NumberingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async createConfig(
    dto: CreateNumberSequenceConfigDto,
    orgId: string,
    branchId: string,
  ) {
    const existing = await this.prisma.numberSequenceConfig.findUnique({
      where: {
        branchId_purpose: {
          branchId,
          purpose: dto.purpose,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Number config for purpose '${dto.purpose}' already exists for this branch`,
      );
    }

    const config = await this.prisma.numberSequenceConfig.create({
      data: {
        ...dto,
        organizationId: orgId,
        branchId,
      },
    });

    await this.eventBus.publish(
      new NumberingConfigCreatedEvent({
        configId: config.id,
        purpose: config.purpose,
        format: config.format,
      }),
    );

    return config;
  }

  async getConfigs(branchId: string) {
    return this.prisma.numberSequenceConfig.findMany({
      where: { branchId, deletedAt: null },
    });
  }

  async generateNextNumber(
    branchId: string,
    academicYearId: string | null,
    purpose: string,
    txClient?: any,
  ): Promise<string> {
    const client = txClient || this.prisma;

    // 1. Get Config
    const config = await client.numberSequenceConfig.findUnique({
      where: {
        branchId_purpose: {
          branchId,
          purpose,
        },
      },
    });

    if (!config) {
      throw new NotFoundException(
        `No numbering sequence config found for purpose '${purpose}' in this branch`,
      );
    }

    // Determine academicYearId for reset/matching
    const counterYearId =
      config.resetStrategy === 'YEARLY' ? academicYearId : null;

    // 2. Find or create counter
    let counter = await client.numberSequenceCounter.findFirst({
      where: {
        configId: config.id,
        academicYearId: counterYearId,
      },
    });

    if (!counter) {
      try {
        counter = await client.numberSequenceCounter.create({
          data: {
            configId: config.id,
            academicYearId: counterYearId,
            currentValue: 0,
          },
        });
      } catch {
        // Handle concurrent create race condition
        counter = await client.numberSequenceCounter.findFirst({
          where: {
            configId: config.id,
            academicYearId: counterYearId,
          },
        });
      }
    }

    // 3. Atomically increment using raw PostgreSQL query to guarantee transaction lock and concurrent safety
    const incrementResult = await client.$queryRaw<any[]>`
      UPDATE "NumberSequenceCounter"
      SET "currentValue" = "currentValue" + 1
      WHERE "id" = ${counter.id}
      RETURNING "currentValue"
    `;

    if (!incrementResult || incrementResult.length === 0) {
      throw new Error('Failed to increment sequence counter');
    }

    const nextValue = incrementResult[0].currentValue;

    // 4. Resolve format placeholders
    let branchCode = '';
    if (config.includeBranchCode) {
      const branch = await client.branch.findUnique({
        where: { id: branchId },
      });
      branchCode = branch ? branch.code : '';
    }

    let yearName = '';
    if (config.includeAcademicYear && academicYearId) {
      const year = await client.academicYear.findUnique({
        where: { id: academicYearId },
      });
      yearName = year ? year.name : '';
    }

    const sequenceStr = String(nextValue).padStart(config.sequencePadding, '0');

    let formatted = config.format;
    formatted = formatted.replace(/{prefix}/g, config.prefix || '');
    formatted = formatted.replace(/{suffix}/g, config.suffix || '');
    formatted = formatted.replace(/{branchCode}/g, branchCode);
    formatted = formatted.replace(/{year}/g, yearName);
    formatted = formatted.replace(/{sequence}/g, sequenceStr);

    // Clean up empty double separators (e.g. if prefix is empty)
    return formatted.replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
}
