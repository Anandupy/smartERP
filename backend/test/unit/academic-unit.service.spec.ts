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

  const GRADE_1 = {
    id: 'grade-1',
    parentId: null,
    name: 'Grade 1',
    unitType: AcademicUnitType.CLASS,
    level: 0,
  };
  const DIVISION_A = {
    id: 'division-a',
    parentId: 'grade-1',
    name: 'Division A',
    unitType: AcademicUnitType.DIVISION,
    level: 1,
  };
  const DIVISION_B = {
    id: 'division-b',
    parentId: 'grade-1',
    name: 'Division B',
    unitType: AcademicUnitType.DIVISION,
    level: 1,
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
        parentId: null,
        name: 'Unit 1',
        children: [],
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
        parentId: null,
        name: 'Unit 1',
        children: [],
      });
      mockPrismaService.academicUnit.count.mockResolvedValue(2);

      await expect(
        service.softDeleteAcademicUnit('unit1', 'user1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllAcademicUnits — placement decoration', () => {
    it('builds the full path and marks only leaves as placement targets', async () => {
      mockPrismaService.academicUnit.findMany.mockResolvedValue([
        GRADE_1,
        DIVISION_A,
        DIVISION_B,
      ]);

      const units = await service.getAllAcademicUnits('branch1', 'year1');

      const grade1 = units.find((u: any) => u.id === 'grade-1');
      const divisionA = units.find((u: any) => u.id === 'division-a');

      expect(grade1).toMatchObject({
        displayPath: 'Grade 1',
        isPlacementTarget: false,
      });
      expect(divisionA).toMatchObject({
        displayPath: 'Grade 1 → Division A',
        isPlacementTarget: true,
      });

      // No round trip per unit: the whole hierarchy for one branch-year is
      // already in the list, so building every path stays in memory.
      expect(mockPrismaService.academicUnit.findUnique).not.toHaveBeenCalled();
    });

    it('treats a unit with no children as a placement target', async () => {
      mockPrismaService.academicUnit.findMany.mockResolvedValue([GRADE_1]);

      const [unit] = await service.getAllAcademicUnits('branch1', 'year1');

      expect(unit).toMatchObject({
        displayPath: 'Grade 1',
        isPlacementTarget: true,
      });
    });
  });

  describe('getAcademicUnitById — ancestor path', () => {
    it('returns the root-first ancestor chain and a joined display path', async () => {
      mockPrismaService.academicUnit.findUnique.mockImplementation(
        ({ where }: any) => {
          if (where.id === 'division-a') {
            return Promise.resolve({
              ...DIVISION_A,
              parent: GRADE_1,
              children: [],
            });
          }
          if (where.id === 'grade-1') return Promise.resolve(GRADE_1);
          return Promise.resolve(null);
        },
      );

      const unit = await service.getAcademicUnitById('division-a');

      expect(unit.ancestors).toEqual([
        expect.objectContaining({
          id: 'grade-1',
          displayPath: 'Grade 1',
          isPlacementTarget: false,
        }),
      ]);
      expect(unit.displayPath).toBe('Grade 1 → Division A');
      expect(unit.isPlacementTarget).toBe(true);
    });

    it('has no ancestors and no path prefix at the root', async () => {
      mockPrismaService.academicUnit.findUnique.mockResolvedValue({
        ...GRADE_1,
        parent: null,
        children: [{ id: 'division-a' }],
      });

      const unit = await service.getAcademicUnitById('grade-1');

      expect(unit.ancestors).toEqual([]);
      expect(unit.displayPath).toBe('Grade 1');
      // One live child, so this node is structural, not a placement target.
      expect(unit.isPlacementTarget).toBe(false);
    });
  });
});
