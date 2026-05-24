import { Test, TestingModule } from '@nestjs/testing';
import { ProgramService } from './program.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProgramLevel } from '@prisma/client';

describe('ProgramService', () => {
  let service: ProgramService;

  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
    },
    program: {
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
        ProgramService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProgramService>(ProgramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProgram', () => {
    const createDto = {
      branchId: 'branch-1',
      name: 'Primary',
      level: ProgramLevel.SCHOOL,
      medium: 'English',
    };

    it('should throw NotFoundException if branch does not exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.createProgram(createDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if parent is in different branch', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.program.findUnique.mockResolvedValue({
        id: 'parent-1',
        branchId: 'branch-2',
      });

      await expect(
        service.createProgram({ ...createDto, parentId: 'parent-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate exists', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.program.findFirst.mockResolvedValue({ id: 'existing-1' });

      await expect(service.createProgram(createDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create program successfully', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.program.findFirst.mockResolvedValue(null);
      mockPrisma.program.create.mockResolvedValue({
        id: 'new-program',
        ...createDto,
      });

      const result = await service.createProgram(createDto, 'user-1');
      expect(result.id).toBe('new-program');
      expect(mockPrisma.program.create).toHaveBeenCalled();
    });
  });

  describe('updateProgram', () => {
    it('should prevent circular hierarchy', async () => {
      const id = 'program-child';
      const parentId = 'program-parent';

      mockPrisma.program.findUnique
        .mockResolvedValueOnce({ id, branchId: 'branch-1', parentId: null }) // for program lookup
        .mockResolvedValueOnce({
          id: parentId,
          branchId: 'branch-1',
          parentId: id,
        }); // for parent lookup

      // For circularity check loop
      mockPrisma.program.findUnique.mockResolvedValueOnce({
        id: parentId,
        parentId: id,
      });

      await expect(
        service.updateProgram(id, { parentId }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDeleteProgram', () => {
    it('should throw BadRequestException if program has active children', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({
        id: 'p1',
        isDeleted: false,
      });
      mockPrisma.program.count.mockResolvedValue(1);

      await expect(service.softDeleteProgram('p1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
