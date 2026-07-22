import { Test, TestingModule } from '@nestjs/testing';
import { AcademicYearService } from '@/modules/academic-year/academic-year.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let prisma: PrismaService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
    },
    academicYear: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<AcademicYearService>(AcademicYearService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: '2025-26',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      branchId: 'branch-1',
    };

    it('should throw BadRequestException if startDate >= endDate', async () => {
      await expect(
        service.create({ ...createDto, endDate: '2025-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if branch not found', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if years overlap', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create year and auto-select if first', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.academicYear.findFirst.mockResolvedValue(null);
      mockPrisma.academicYear.count.mockResolvedValue(0);
      mockPrisma.academicYear.create.mockResolvedValue({ id: 'new-year' });

      await service.create(createDto);

      expect(mockPrisma.academicYear.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
            isSelected: true,
          }),
        }),
      );
    });
  });

  describe('select', () => {
    it('should deactivate others and select target in transaction', async () => {
      const year = { id: 'year-1', branchId: 'branch-1', isDeleted: false };
      mockPrisma.academicYear.findUnique.mockResolvedValue(year);

      await service.select('year-1');

      expect(mockPrisma.academicYear.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: 'branch-1', isSelected: true },
          data: { isSelected: false },
        }),
      );
      expect(mockPrisma.academicYear.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'year-1' },
          data: { isSelected: true },
        }),
      );
    });
  });

  describe('lock', () => {
    it('should set isLocked to true', async () => {
      mockPrisma.academicYear.findUnique.mockResolvedValue({
        id: 'year-1',
        isDeleted: false,
      });
      await service.lock('year-1');
      expect(mockPrisma.academicYear.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'year-1' },
          data: { isLocked: true },
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('should throw ForbiddenException if locked', async () => {
      mockPrisma.academicYear.findUnique.mockResolvedValue({
        id: 'year-1',
        isLocked: true,
        isDeleted: false,
      });
      await expect(service.softDelete('year-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if selected', async () => {
      mockPrisma.academicYear.findUnique.mockResolvedValue({
        id: 'year-1',
        isLocked: false,
        isSelected: true,
        isDeleted: false,
      });
      await expect(service.softDelete('year-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
