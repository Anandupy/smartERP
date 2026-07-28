import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  CommunicationChannel,
  CommunicationTemplate,
  TemplateStatus,
} from '@/generated/client';
import { HandlebarsTemplateRenderer } from '../renderer/handlebars-template.renderer';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { RenderResult } from '../renderer/template-renderer.interface';
import { TemplateUpdatedEvent } from '@/common/events/communication.events';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: HandlebarsTemplateRenderer,
    private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateTemplateDto,
    userId?: string,
  ): Promise<CommunicationTemplate> {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: {
        code: dto.code,
        channel: dto.channel,
        language: dto.language || 'en',
        version: dto.version || 1,
        organizationId: dto.organizationId || null,
        branchId: dto.branchId || null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Template with code '${dto.code}' and version '${dto.version || 1}' already exists for channel '${dto.channel}'`,
      );
    }

    // Automatically infer variables if not supplied
    let detectedVars = dto.variables || [];
    if (!dto.variables || dto.variables.length === 0) {
      const extracted = new Set<string>([
        ...this.renderer.extractVariables(dto.subject || ''),
        ...this.renderer.extractVariables(dto.bodyHtml || ''),
        ...this.renderer.extractVariables(dto.bodyText || ''),
      ]);
      detectedVars = Array.from(extracted);
    }

    const template = await this.prisma.communicationTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        channel: dto.channel,
        category: dto.category,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        variables: detectedVars,
        language: dto.language || 'en',
        version: dto.version || 1,
        status: dto.status || TemplateStatus.DRAFT,
        organizationId: dto.organizationId || null,
        branchId: dto.branchId || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new TemplateUpdatedEvent({
        templateId: template.id,
        code: template.code,
        channel: template.channel,
        version: template.version,
        action: 'CREATE',
      }),
    );

    return template;
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    userId?: string,
  ): Promise<CommunicationTemplate> {
    const template = await this.prisma.communicationTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }

    let detectedVars = dto.variables || (template.variables as string[]) || [];
    if (
      dto.subject !== undefined ||
      dto.bodyHtml !== undefined ||
      dto.bodyText !== undefined
    ) {
      const subject =
        dto.subject !== undefined ? dto.subject : template.subject || '';
      const bodyHtml =
        dto.bodyHtml !== undefined ? dto.bodyHtml : template.bodyHtml || '';
      const bodyText =
        dto.bodyText !== undefined ? dto.bodyText : template.bodyText || '';

      const extracted = new Set<string>([
        ...this.renderer.extractVariables(subject || ''),
        ...this.renderer.extractVariables(bodyHtml || ''),
        ...this.renderer.extractVariables(bodyText || ''),
      ]);
      detectedVars = Array.from(extracted);
    }

    const updated = await this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        variables: detectedVars,
        status: dto.status,
        updatedBy: userId,
      },
    });

    await this.eventBus.publish(
      new TemplateUpdatedEvent({
        templateId: updated.id,
        code: updated.code,
        channel: updated.channel,
        version: updated.version,
        action: 'UPDATE',
      }),
    );

    return updated;
  }

  async findById(id: string): Promise<CommunicationTemplate> {
    const template = await this.prisma.communicationTemplate.findUnique({
      where: { id },
    });
    if (!template)
      throw new NotFoundException(`Template with ID '${id}' not found`);
    return template;
  }

  /**
   * Hierarchical fallback resolution logic:
   * 1. Branch specific template (branchId & orgId match)
   * 2. Organization specific template (orgId match, branchId null)
   * 3. Global template (orgId null, branchId null)
   */
  async resolveTemplate(
    code: string,
    channel: CommunicationChannel,
    context?: { organizationId?: string; branchId?: string; language?: string },
  ): Promise<CommunicationTemplate> {
    const language = context?.language || 'en';

    // 1. Check Branch Specific
    if (context?.branchId && context?.organizationId) {
      const branchTpl = await this.prisma.communicationTemplate.findFirst({
        where: {
          code,
          channel,
          language,
          organizationId: context.organizationId,
          branchId: context.branchId,
          status: TemplateStatus.PUBLISHED,
        },
        orderBy: { version: 'desc' },
      });
      if (branchTpl) return branchTpl;
    }

    // 2. Check Org Specific
    if (context?.organizationId) {
      const orgTpl = await this.prisma.communicationTemplate.findFirst({
        where: {
          code,
          channel,
          language,
          organizationId: context.organizationId,
          branchId: null,
          status: TemplateStatus.PUBLISHED,
        },
        orderBy: { version: 'desc' },
      });
      if (orgTpl) return orgTpl;
    }

    // 3. Fallback to Global / Default
    const globalTpl = await this.prisma.communicationTemplate.findFirst({
      where: {
        code,
        channel,
        language,
        organizationId: null,
        branchId: null,
        status: TemplateStatus.PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });

    if (globalTpl) return globalTpl;

    // 4. Any status (draft/fallback) fallback
    const fallbackTpl = await this.prisma.communicationTemplate.findFirst({
      where: { code, channel },
      orderBy: { version: 'desc' },
    });

    if (!fallbackTpl) {
      throw new NotFoundException(
        `Communication template with code '${code}' for channel '${channel}' not found`,
      );
    }

    return fallbackTpl;
  }

  renderTemplate(
    template: CommunicationTemplate,
    variables: Record<string, any>,
  ): RenderResult {
    return this.renderer.render(template, variables);
  }

  async renderPreview(
    templateId: string | undefined,
    code: string | undefined,
    channel: CommunicationChannel | undefined,
    variables: Record<string, any>,
  ): Promise<RenderResult> {
    let template: CommunicationTemplate;

    if (templateId) {
      template = await this.findById(templateId);
    } else if (code && channel) {
      template = await this.resolveTemplate(code, channel);
    } else {
      throw new ConflictException(
        'Either templateId or both code and channel must be provided for preview',
      );
    }

    return this.renderTemplate(template, variables);
  }

  async findAll(params: {
    channel?: CommunicationChannel;
    category?: any;
    status?: TemplateStatus;
    search?: string;
  }) {
    const where: any = {};
    if (params.channel) where.channel = params.channel;
    if (params.category) where.category = params.category;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.communicationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
