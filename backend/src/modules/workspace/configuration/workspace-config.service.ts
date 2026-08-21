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
    private readonly requestContext: RequestContextService,
  ) {
    this.logger.setContext(WorkspaceConfigService.name);
  }

  async resolveConfiguration(
    organizationId?: string | null,
    branchId?: string | null,
    role?: string | null,
    userId?: string | null,
  ): Promise<ResolvedWorkspaceConfig> {
    const scopes: Array<{ type: WorkspaceScopeType; id: string | null }> = [
      { type: WorkspaceScopeType.PRODUCT, id: null },
    ];

    if (organizationId) {
      scopes.push({
        type: WorkspaceScopeType.ORGANIZATION,
        id: organizationId,
      });
    }

    if (branchId) {
      scopes.push({ type: WorkspaceScopeType.BRANCH, id: branchId });
    }

    if (role) {
      scopes.push({ type: WorkspaceScopeType.ROLE, id: role });
    }

    if (userId) {
      scopes.push({ type: WorkspaceScopeType.USER, id: userId });
    }

    const configs = await this.prisma.workspaceConfiguration.findMany({
      where: {
        OR: scopes.map((s) => ({
          scopeType: s.type,
          scopeId: s.id,
        })),
        isActive: true,
      },
    });

    const configMap = new Map<string, any>();
    for (const cfg of configs) {
      const key = `${cfg.scopeType}:${cfg.scopeId || 'GLOBAL'}`;
      configMap.set(key, cfg);
    }

    let resolvedNav: Record<string, any> = {};
    let resolvedClient: Record<string, any> = {};

    for (const scope of scopes) {
      const key = `${scope.type}:${scope.id || 'GLOBAL'}`;
      const cfg = configMap.get(key);
      if (cfg) {
        if (
          cfg.navigationPreferences &&
          typeof cfg.navigationPreferences === 'object'
        ) {
          resolvedNav = { ...resolvedNav, ...cfg.navigationPreferences };
        }
        if (
          cfg.clientPreferences &&
          typeof cfg.clientPreferences === 'object'
        ) {
          resolvedClient = { ...resolvedClient, ...cfg.clientPreferences };
        }
      }
    }

    return {
      navigationPreferences: resolvedNav,
      clientPreferences: resolvedClient,
    };
  }

  /**
   * Reads a single layer by the same scopeType/scopeId key `upsertConfiguration`
   * keys its lookup on. Returns `null` rather than the merged/resolved config
   * `resolveConfiguration` produces — this is "what was saved for this exact
   * scope," not "what a user in this scope effectively sees."
   */
  async getConfiguration(
    scopeType: WorkspaceScopeType,
    scopeId: string | null,
  ): Promise<any> {
    return this.prisma.workspaceConfiguration.findFirst({
      where: {
        scopeType,
        scopeId: scopeId || null,
      },
    });
  }

  async upsertConfiguration(
    scopeType: WorkspaceScopeType,
    scopeId: string | null,
    navigationPreferences?: Record<string, any>,
    clientPreferences?: Record<string, any>,
  ): Promise<any> {
    const context = this.requestContext.getContext();
    const updatedBy = context?.userId || 'SYSTEM';

    const existing = await this.prisma.workspaceConfiguration.findFirst({
      where: {
        scopeType,
        scopeId: scopeId || null,
      },
    });

    let config: any;

    if (existing) {
      config = await this.prisma.workspaceConfiguration.update({
        where: { id: existing.id },
        data: {
          navigationPreferences: navigationPreferences
            ? ({
                ...(existing.navigationPreferences as object),
                ...navigationPreferences,
              } as any)
            : (existing.navigationPreferences as any),
          clientPreferences: clientPreferences
            ? ({
                ...(existing.clientPreferences as object),
                ...clientPreferences,
              } as any)
            : (existing.clientPreferences as any),
        },
      });
    } else {
      config = await this.prisma.workspaceConfiguration.create({
        data: {
          scopeType,
          scopeId: scopeId || null,
          navigationPreferences: (navigationPreferences as any) || {},
          clientPreferences: (clientPreferences as any) || {},
        },
      });
    }

    await this.eventBus.publish(
      new WorkspaceConfigurationUpdatedEvent({
        configId: config.id,
        scopeType,
        scopeId,
        updatedBy,
      }),
    );

    this.logger.log(
      `Workspace configuration updated for ${scopeType}:${config.scopeId || 'GLOBAL'}`,
    );

    return config;
  }
}
