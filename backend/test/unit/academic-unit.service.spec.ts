import { Test, TestingModule } from '@nestjs/testing';
import { AcademicUnitService } from '@/modules/academic-unit/academic-unit.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AcademicUnitType } from '@/generated/client';

describe('AcademicUnitService', () => {
  let service: AcademicUnitService;
  let prismaService: PrismaService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  const mockPrismaService = {
    branch: { findUnique: jest.fn() },
    program: { findUnique: jest.fn() },
    academicYear: { findUnique: jest.fn() },
    academicUnit: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicUnitService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<AcademicUnitService>(AcademicUnitService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAcademicUnit', () => {
    it('should successfully create an academic unit', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue({ id: 'branch1' });
      mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog1' });
      mockPrismaService.academicYear.findUnique.mockResolvedValue({
        id: 'year1',
      });
      mockPrismaService.academicUnit.findFirst.mockResolvedValue(null);
      mockPrismaService.academicUnit.create.mockResolvedValue({
        id: 'unit1',
        name: 'Std 1',
        level: 0,
      });

      const dto = {
        branchId: 'branch1',
        programId: 'prog1',
        academicYearId: 'year1',
        name: 'Std 1',
        unitType: AcademicUnitType.CLASS,
      };

      const result = await service.createAcademicUnit(dto, 'user1');

      expect(result).toBeDefined();
      expect(result.level).toBe(0);
      expect(mockPrismaService.academicUnit.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue(null);

      await expect(
        service.createAcademicUnit({ branchId: 'invalid' } as any, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if sibling with same name exists', async () => {
      mockPrismaService.branch.findUnique.mockResolvedValue({ id: 'branch1' });
      mockPrismaService.program.findUnique.mockResolvedValue({ id: 'prog1' });
      mockPrismaService.academicYear.findUnique.mockResolvedValue({
        id: 'year1',
      });
      mockPrismaService.academicUnit.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.createAcademicUnit(
          {
            branchId: 'branch1',
            programId: 'prog1',
            academicYearId: 'year1',
            name: 'Std 1',
            unitType: AcademicUnitType.CLASS,
          },
          'user1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDeleteAcademicUnit', () => {
    it('should soft delete if no active children', async () => {
      mockPrismaService.academicUnit.findUnique.mockResolvedValue({
        id: 'unit1',
      });
      mockPrismaService.academicUnit.count.mockResolvedValue(0);
      mockPrismaService.academicUnit.update.mockResolvedValue({
        id: 'unit1',
        isDeleted: true,
      });

      const result = await service.softDeleteAcademicUnit('unit1', 'user1');

      expect(result.isDeleted).toBe(true);
      expect(mockPrismaService.academicUnit.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if active children exist', async () => {
      mockPrismaService.academicUnit.findUnique.mockResolvedValue({
        id: 'unit1',
      });
      mockPrismaService.academicUnit.count.mockResolvedValue(2);

      await expect(
        service.softDeleteAcademicUnit('unit1', 'user1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
