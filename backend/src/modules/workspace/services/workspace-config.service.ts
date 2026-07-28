import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RequestContextService } from '@/common/logger/request-context.service';
import { WorkspaceScopeType } from '@/generated/client';
import { WorkspaceConfigurationUpdatedEvent } from '@/common/events/workspace.events';

export interface ResolvedWorkspaceConfig {
  navigationPreferences: Record<string, any>;
  clientPreferences: Record<string, any>;
}

@Injectable()
export class WorkspaceConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
    private readonly requestContextService: RequestContextService,
  ) {
    this.logger.setContext(WorkspaceConfigService.name);
  }

  /**
   * Deterministic Layered Configuration Resolution
   * Inheritance Precedence Order:
   * 1. PRODUCT (Global product defaults)
   * 2. ORGANIZATION (Organization level override)
   * 3. BRANCH (Branch level override)
   * 4. ROLE (Role level override)
   * 5. USER (User specific personal preference override)
   */
  async resolveConfiguration(
    organizationId?: string | null,
    branchId?: string | null,
    role?: string | null,
    userId?: string | null,
  ): Promise<ResolvedWorkspaceConfig> {
    const scopeConditions: Array<{
      scopeType: WorkspaceScopeType;
      scopeId: string | null;
    }> = [{ scopeType: WorkspaceScopeType.PRODUCT, scopeId: null }];

    if (organizationId) {
      scopeConditions.push({
        scopeType: WorkspaceScopeType.ORGANIZATION,
        scopeId: organizationId,
      });
    }
    if (branchId) {
      scopeConditions.push({
        scopeType: WorkspaceScopeType.BRANCH,
        scopeId: branchId,
      });
    }
    if (role) {
      scopeConditions.push({
        scopeType: WorkspaceScopeType.ROLE,
        scopeId: role,
      });
    }
    if (userId) {
      scopeConditions.push({
        scopeType: WorkspaceScopeType.USER,
        scopeId: userId,
      });
    }

    const configs = await this.prisma.workspaceConfiguration.findMany({
      where: {
        isActive: true,
        OR: scopeConditions.map((c) => ({
          scopeType: c.scopeType,
          scopeId: c.scopeId,
        })),
      },
    });

    // Create lookup map for quick ordering
    const configMap = new Map<string, any>();
    for (const cfg of configs) {
      const key = `${cfg.scopeType}:${cfg.scopeId || 'GLOBAL'}`;
      configMap.set(key, cfg);
    }

    let mergedNav: Record<string, any> = {
      sidebarCollapsed: false,
      sidebarPosition: 'left',
      denseMode: false,
      defaultRoute: '/dashboard',
    };
    let mergedClient: Record<string, any> = {
      theme: 'system',
      locale: 'en',
    };

    // Apply layers sequentially in deterministic order
    for (const cond of scopeConditions) {
      const key = `${cond.scopeType}:${cond.scopeId || 'GLOBAL'}`;
      const layer = configMap.get(key);
      if (layer) {
        if (
          layer.navigationPreferences &&
          typeof layer.navigationPreferences === 'object'
        ) {
          mergedNav = {
            ...mergedNav,
            ...(layer.navigationPreferences as Record<string, any>),
          };
        }
        if (
          layer.clientPreferences &&
          typeof layer.clientPreferences === 'object'
        ) {
          mergedClient = {
            ...mergedClient,
            ...(layer.clientPreferences as Record<string, any>),
          };
        }
      }
    }

    return {
      navigationPreferences: mergedNav,
      clientPreferences: mergedClient,
    };
  }

  /**
   * Upsert a Workspace Configuration layer
   */
  async upsertConfiguration(
    scopeType: WorkspaceScopeType,
    scopeId: string | null,
    navigationPreferences?: Record<string, any>,
    clientPreferences?: Record<string, any>,
  ) {
    const context = this.requestContextService.getContext();
    const updatedBy = context?.userId || 'SYSTEM';

    const normalizedScopeId =
      scopeType === WorkspaceScopeType.PRODUCT ? null : scopeId;

    const existing = await this.prisma.workspaceConfiguration.findFirst({
      where: {
        scopeType,
        scopeId: normalizedScopeId,
      },
    });

    let config;
    if (existing) {
      config = await this.prisma.workspaceConfiguration.update({
        where: { id: existing.id },
        data: {
          navigationPreferences:
            navigationPreferences ?? (existing.navigationPreferences as any),
          clientPreferences:
            clientPreferences ?? (existing.clientPreferences as any),
          updatedAt: new Date(),
        },
      });
    } else {
      config = await this.prisma.workspaceConfiguration.create({
        data: {
          scopeType,
          scopeId: normalizedScopeId,
          navigationPreferences: navigationPreferences || {},
          clientPreferences: clientPreferences || {},
          createdById: updatedBy,
        },
      });
    }

    await this.eventBus.publish(
      new WorkspaceConfigurationUpdatedEvent({
        configId: config.id,
        scopeType: config.scopeType,
        scopeId: config.scopeId,
        updatedBy,
      }),
    );

    this.logger.log(
      `Workspace configuration updated for ${scopeType}:${config.scopeId || 'GLOBAL'}`,
    );
    return config;
  }
}
