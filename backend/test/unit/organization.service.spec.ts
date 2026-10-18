import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from '@/modules/organization/organization.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { RequestContextService } from '@/common/logger/request-context.service';
import { NotFoundException } from '@nestjs/common';
import {
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  OrganizationDeletedEvent,
} from '@/common/events';

describe('OrganizationService (Unit)', () => {
  let service: OrganizationService;
  let mockPrisma: any;
  let mockEventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let mockRequestContext: { getContext: jest.Mock };

  beforeEach(async () => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    mockRequestContext = { getContext: jest.fn().mockReturnValue(undefined) };

    mockPrisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBus, useValue: mockEventBus },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should create an organization and publish OrganizationCreatedEvent', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: 'org-123',
      name: 'Test Org',
      code: 'test-org',
      status: 'ACTIVE',
    });

    const result = await service.createOrganization({
      name: 'Test Org',
      code: 'test-org',
      contactEmail: 'org@test.com',
      contactPhone: '1234567890',
      masterExpiryDate: new Date().toISOString() as any,
    });

    expect(result.id).toBe('org-123');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(OrganizationCreatedEvent),
    );
  });

  it('should update an organization and publish OrganizationUpdatedEvent', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-123',
      name: 'Old Org',
      code: 'old-org',
    });
    mockPrisma.organization.update.mockResolvedValue({
      id: 'org-123',
      name: 'New Org',
      code: 'old-org',
    });

    const result = await service.updateOrganization('org-123', {
      name: 'New Org',
    });

    expect(result.name).toBe('New Org');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(OrganizationUpdatedEvent),
    );
  });

  it('should soft delete an organization and publish OrganizationDeletedEvent', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-123',
      name: 'Test Org',
      code: 'test-org',
    });
    mockPrisma.organization.update.mockResolvedValue({
      id: 'org-123',
      status: 'INACTIVE',
    });

    await service.softDeleteOrganization('org-123');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(OrganizationDeletedEvent),
    );
  });

  describe('tenant scoping', () => {
    it('lists only the caller organization for ORG_ADMIN', async () => {
      mockRequestContext.getContext.mockReturnValue({
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });
      mockPrisma.organization.findMany.mockResolvedValue([]);

      await service.getAllOrganizations();

      expect(mockPrisma.organization.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ id: 'org-1' }),
      );
    });

    it('lists nothing for a non-super-admin without an organization', async () => {
      mockRequestContext.getContext.mockReturnValue({
        role: 'ORG_ADMIN',
        organizationId: null,
      });

      await expect(service.getAllOrganizations()).resolves.toEqual([]);
      expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
    });

    it('reports another tenant organization as not found', async () => {
      mockRequestContext.getContext.mockReturnValue({
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-2' });

      await expect(service.getOrganizationById('org-2')).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.updateOrganization('org-2', { name: 'Hijacked' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });
});
