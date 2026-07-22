import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from '@/modules/organization/organization.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { OrganizationCreatedEvent, OrganizationUpdatedEvent, OrganizationDeletedEvent } from '@/common/events';

describe('OrganizationService (Unit)', () => {
  let service: OrganizationService;
  let mockPrisma: any;
  let mockEventBus: { publish: jest.Mock; subscribe: jest.Mock };

  beforeEach(async () => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

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
});
