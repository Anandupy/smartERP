import { Test, TestingModule } from '@nestjs/testing';
import { TemplateService } from './template.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { HandlebarsTemplateRenderer } from '../renderer/handlebars-template.renderer';
import {
  CommunicationChannel,
  NotificationCategory,
  TemplateStatus,
} from '@/generated/client';

describe('TemplateService', () => {
  let service: TemplateService;
  let prismaService: any;
  let eventBus: any;

  const mockTemplate = {
    id: 'tpl-100',
    code: 'WELCOME_EMAIL',
    name: 'Welcome Email',
    channel: CommunicationChannel.EMAIL,
    category: NotificationCategory.AUTHENTICATION,
    subject: 'Welcome {{userName}}',
    bodyHtml: '<p>Welcome!</p>',
    bodyText: 'Welcome!',
    variables: ['userName'],
    language: 'en',
    version: 1,
    status: TemplateStatus.PUBLISHED,
    organizationId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      communicationTemplate: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        HandlebarsTemplateRenderer,
        { provide: PrismaService, useValue: prismaService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a template and publish TemplateUpdatedEvent', async () => {
    prismaService.communicationTemplate.findFirst.mockResolvedValue(null);
    prismaService.communicationTemplate.create.mockResolvedValue(mockTemplate);

    const result = await service.create({
      code: 'WELCOME_EMAIL',
      name: 'Welcome Email',
      channel: CommunicationChannel.EMAIL,
      category: NotificationCategory.AUTHENTICATION,
      subject: 'Welcome {{userName}}',
    });

    expect(result).toEqual(mockTemplate);
    expect(prismaService.communicationTemplate.create).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should hierarchically resolve templates (Branch -> Org -> Global)', async () => {
    prismaService.communicationTemplate.findFirst
      .mockResolvedValueOnce(null) // Branch check fails
      .mockResolvedValueOnce(null) // Org check fails
      .mockResolvedValueOnce(mockTemplate); // Global succeeds

    const result = await service.resolveTemplate(
      'WELCOME_EMAIL',
      CommunicationChannel.EMAIL,
      {
        organizationId: 'org-1',
        branchId: 'branch-1',
      },
    );

    expect(result).toEqual(mockTemplate);
    expect(prismaService.communicationTemplate.findFirst).toHaveBeenCalledTimes(
      3,
    );
  });
});
