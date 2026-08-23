import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '@/modules/user/user.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PasswordService } from '@/common/services/password.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@/common/enums/role.enum';
import { RoleType } from '@/generated/client';
import { buildRequestContext } from '../factories/request-context.factory';

describe('UserService', () => {
  let service: UserService;

  const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
  };

  const mockPasswordService = {
    hash: jest.fn().mockResolvedValue('hashed-password'),
  };

  const baseDto = {
    fullName: 'Test',
    username: 'test',
    email: 'test@test.com',
    phone: '123',
    password: 'password',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createUser', () => {
    it('throws ConflictException if user already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ email: 'test@test.com' });

      await expect(
        service.createUser({ ...baseDto, role: 'STAFF' as any }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows an unauthenticated (internal) caller to create any role', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        role: RoleType.SUPER_ADMIN,
      });

      await expect(
        service.createUser({ ...baseDto, role: RoleType.SUPER_ADMIN }),
      ).resolves.toBeDefined();
    });

    it('lets SUPER_ADMIN provision an ORG_ADMIN with no organization yet', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        role: RoleType.ORG_ADMIN,
      });
      const context = buildRequestContext({ role: UserRole.SUPER_ADMIN });

      await service.createUser(
        { ...baseDto, role: RoleType.ORG_ADMIN },
        'super-1',
        context,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: null,
            branchId: null,
          }),
        }),
      );
    });

    it('rejects ORG_ADMIN attempting to create another ORG_ADMIN', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.createUser(
          { ...baseDto, role: RoleType.ORG_ADMIN },
          'org-admin-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects ORG_ADMIN attempting to escalate to SUPER_ADMIN', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.createUser(
          { ...baseDto, role: RoleType.SUPER_ADMIN },
          'org-admin-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('defaults organizationId to the ORG_ADMIN caller own organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        role: RoleType.STAFF,
      });
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await service.createUser(
        { ...baseDto, role: RoleType.STAFF },
        'org-admin-1',
        context,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
    });

    it('rejects an ORG_ADMIN naming a different organization in the body', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.createUser(
          { ...baseDto, role: RoleType.STAFF, organizationId: 'org-2' },
          'org-admin-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects an organizationId that does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      const context = buildRequestContext({ role: UserRole.SUPER_ADMIN });

      await expect(
        service.createUser(
          {
            ...baseDto,
            role: RoleType.ORG_ADMIN,
            organizationId: 'missing-org',
          },
          'super-1',
          context,
        ),
      ).rejects.toThrow('Organization not found');
    });

    it('rejects a branch that belongs to a different organization', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-2',
      });
      const context = buildRequestContext({ role: UserRole.SUPER_ADMIN });

      await expect(
        service.createUser(
          {
            ...baseDto,
            role: RoleType.STAFF,
            organizationId: 'org-1',
            branchId: 'branch-1',
          },
          'super-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByIdForActor', () => {
    it('rejects an ORG_ADMIN reading a user from a different organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        organizationId: 'org-2',
      });
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(service.findByIdForActor('u1', context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an ORG_ADMIN reading a user from their own organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        organizationId: 'org-1',
      });
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.findByIdForActor('u1', context),
      ).resolves.toMatchObject({ id: 'u1' });
    });
  });

  describe('updateUser', () => {
    it('rejects an ORG_ADMIN updating a user outside their organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        organizationId: 'org-2',
      });
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.updateUser(
          'u1',
          { fullName: 'New Name' },
          'org-admin-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an ORG_ADMIN escalating an existing user to SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        organizationId: 'org-1',
      });
      const context = buildRequestContext({
        role: UserRole.ORG_ADMIN,
        organizationId: 'org-1',
      });

      await expect(
        service.updateUser(
          'u1',
          { role: RoleType.SUPER_ADMIN },
          'org-admin-1',
          context,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
