import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import {
  MaintenanceRuleCreatedEvent,
  MaintenanceRuleUpdatedEvent,
  MaintenanceRuleDeletedEvent,
} from '@/common/events/maintenance.events';
import { CreateMaintenanceRuleDto } from './dto/create-maintenance-rule.dto';
import { UpdateMaintenanceRuleDto } from './dto/update-maintenance-rule.dto';
import { MaintenanceException } from '@/common/filters/maintenance.exception';

export interface MaintenanceCheckContext {
  userId?: string | null;
  role?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  // In-memory cache of active rules (resolved on mutations)
  private rulesCache: any[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Invalidates the in-memory rules cache
   */
  invalidateCache() {
    this.rulesCache = null;
    this.logger.log('Maintenance rules cache invalidated.');
  }

  /**
   * Returns all active/scheduled rules from cache or database
   */
  async getActiveRules(): Promise<any[]> {
    if (this.rulesCache) {
      return this.rulesCache;
    }

    // Query active rules.
    const rules = await this.prisma.maintenanceRule.findMany({
      where: {
        isActive: true,
      },
    });

    this.rulesCache = rules;
    return rules;
  }

  /**
   * Creates a new maintenance rule
   */
  async createRule(dto: CreateMaintenanceRuleDto, userId?: string) {
    const rule = await this.prisma.maintenanceRule.create({
      data: {
        ...dto,
        bypassRoles: dto.bypassRoles
          ? JSON.parse(JSON.stringify(dto.bypassRoles))
          : undefined,
        createdBy: userId,
      },
    });

    this.invalidateCache();

    const action = this.inferAuditAction(rule, 'create');
    await this.eventBus.publish(
      new MaintenanceRuleCreatedEvent(rule, { action, module: 'SYSTEM' }),
    );

    return rule;
  }

  /**
   * Updates an existing maintenance rule
   */
  async updateRule(id: string, dto: UpdateMaintenanceRuleDto, userId?: string) {
    const oldRule = await this.prisma.maintenanceRule.findUnique({
      where: { id },
    });

    if (!oldRule) {
      throw new NotFoundException(`Maintenance rule with ID ${id} not found`);
    }

    const updated = await this.prisma.maintenanceRule.update({
      where: { id },
      data: {
        ...dto,
        bypassRoles: dto.bypassRoles
          ? JSON.parse(JSON.stringify(dto.bypassRoles))
          : undefined,
        updatedBy: userId,
      },
    });

    this.invalidateCache();

    const action = this.inferAuditAction(updated, 'update', oldRule);
    await this.eventBus.publish(
      new MaintenanceRuleUpdatedEvent(updated, { action, module: 'SYSTEM' }),
    );

    return updated;
  }

  /**
   * Deletes a maintenance rule
   */
  async deleteRule(id: string) {
    const oldRule = await this.prisma.maintenanceRule.findUnique({
      where: { id },
    });

    if (!oldRule) {
      throw new NotFoundException(`Maintenance rule with ID ${id} not found`);
    }

    await this.prisma.maintenanceRule.delete({
      where: { id },
    });

    this.invalidateCache();

    const action = this.inferAuditAction(oldRule, 'delete');
    await this.eventBus.publish(
      new MaintenanceRuleDeletedEvent(oldRule, { action, module: 'SYSTEM' }),
    );

    return { message: 'Rule deleted successfully' };
  }

  /**
   * Retrieves a rule by ID
   */
  async getRule(id: string) {
    const rule = await this.prisma.maintenanceRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException(`Maintenance rule with ID ${id} not found`);
    }
    return rule;
  }

  /**
   * Lists all rules
   */
  async listRules() {
    return this.prisma.maintenanceRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Evaluates if a rule is currently active based on dates, timezone, and recurrence.
   */
  isRuleCurrentlyActive(rule: any, now: Date): boolean {
    if (!rule.isActive) return false;

    // Recurring calculation
    if (
      rule.isRecurring &&
      rule.recurrenceStartTime &&
      rule.recurrenceEndTime
    ) {
      const tz = rule.timezone || 'Asia/Kolkata';
      let localDate: Date;
      try {
        localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      } catch {
        localDate = now;
      }

      const currentDay = localDate.getDay(); // 0 = Sunday, 6 = Saturday
      if (
        rule.recurrenceDayOfWeek !== null &&
        rule.recurrenceDayOfWeek !== undefined
      ) {
        if (currentDay !== rule.recurrenceDayOfWeek) {
          return false;
        }
      }

      const [startHour, startMin] = rule.recurrenceStartTime
        .split(':')
        .map(Number);
      const [endHour, endMin] = rule.recurrenceEndTime.split(':').map(Number);

      const currentHour = localDate.getHours();
      const currentMin = localDate.getMinutes();

      const currentMinutes = currentHour * 60 + currentMin;
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes <= endMinutes) {
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
          return false;
        }
      } else {
        // Overnight window (e.g. 23:00 to 02:00)
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
          return false;
        }
      }
      return true;
    }

    // Standard startAt / endAt schedule
    if (rule.startAt) {
      const start = new Date(rule.startAt);
      if (now < start) return false;
    }
    if (rule.endAt) {
      const end = new Date(rule.endAt);
      if (now > end) return false;
    }

    return true;
  }

  /**
   * Main checking mechanism that applies resolution order and throws MaintenanceException if blocked.
   */
  async checkMaintenance(
    context: MaintenanceCheckContext,
    httpMethod: string,
    path: string,
    featureName?: string,
  ): Promise<void> {
    // 1. Bypass check: SUPER_ADMIN always bypasses maintenance
    if (context.role === 'SUPER_ADMIN') {
      return;
    }

    // Exempt maintenance endpoints and basic configs
    const lowercasePath = path.toLowerCase();
    if (
      lowercasePath.includes('/system-settings') ||
      lowercasePath.includes('/maintenance-rules') ||
      lowercasePath.includes('/audit-logs') ||
      lowercasePath.includes('/docs') ||
      lowercasePath.includes('/api-json')
    ) {
      return;
    }

    const activeRules = await this.getActiveRules();
    const now = new Date();

    // Filter rules currently in their active window
    const rules = activeRules.filter((r) => this.isRuleCurrentlyActive(r, now));
    if (rules.length === 0) {
      return;
    }

    // Infer module from path
    const moduleName = this.inferModuleFromPath(path);

    // 2. Precedence resolution: GLOBAL > ORGANIZATION > BRANCH > MODULE > FEATURE.
    let resolvedRule: any = null;

    // GLOBAL
    resolvedRule = rules.find((r) => r.scopeType === 'GLOBAL');

    // ORGANIZATION
    if (!resolvedRule && context.organizationId) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'ORGANIZATION' &&
          r.scopeId === context.organizationId,
      );
    }

    // BRANCH
    if (!resolvedRule && context.branchId) {
      resolvedRule = rules.find(
        (r) => r.scopeType === 'BRANCH' && r.scopeId === context.branchId,
      );
    }

    // MODULE
    if (!resolvedRule && moduleName) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'MODULE' &&
          r.scopeId?.toLowerCase() === moduleName.toLowerCase(),
      );
    }

    // FEATURE
    if (!resolvedRule && featureName) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'FEATURE' &&
          r.scopeId?.toLowerCase() === featureName.toLowerCase(),
      );
    }

    // If no rule matches, allow request
    if (!resolvedRule) {
      return;
    }

    // 3. Bypass checks per rule configuration
    if (context.role) {
      const bypassRoles: string[] = resolvedRule.bypassRoles
        ? (resolvedRule.bypassRoles as string[])
        : [];
      if (bypassRoles.includes(context.role)) {
        return;
      }
    }

    // 4. Operation block check
    const isLoginRequest = lowercasePath.includes('/auth/login');
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod);

    let isBlocked = false;

    if (isLoginRequest) {
      isBlocked = !resolvedRule.allowLogin;
    } else if (isWrite) {
      isBlocked = !resolvedRule.allowWriteApis;
    } else {
      // GET, HEAD, OPTIONS
      isBlocked = !resolvedRule.allowReadApis;
    }

    if (isBlocked) {
      const responsePayload = {
        maintenanceEnabled: true,
        maintenanceScope: resolvedRule.scopeType,
        scopeType: resolvedRule.scopeType,
        scopeId: resolvedRule.scopeId,
        title: resolvedRule.title || 'System Maintenance',
        message:
          resolvedRule.shortMessage || 'The system is under maintenance.',
        description: resolvedRule.description || '',
        reason: resolvedRule.reason || '',
        estimatedCompletion: resolvedRule.estimatedCompletion || null,
        supportContact: resolvedRule.supportContact || '',
        maintenanceWindow: resolvedRule.maintenanceWindow || '',
        readOnly: !resolvedRule.allowWriteApis,
        allowedOperations: resolvedRule.allowWriteApis
          ? ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']
          : ['GET', 'HEAD', 'OPTIONS'],
      };

      throw new MaintenanceException(
        responsePayload,
        resolvedRule.customStatus || 503,
      );
    }
  }

  /**
   * Helper to map paths to modules
   */
  private inferModuleFromPath(path: string): string {
    const p = path.toLowerCase();
    if (
      p.includes('/academic-years') ||
      p.includes('/academic-units') ||
      p.includes('/programs')
    ) {
      return 'academic';
    }
    if (
      p.includes('/admissions') ||
      p.includes('/applicants') ||
      p.includes('/guardians') ||
      p.includes('/enrollments') ||
      p.includes('/number-sequence')
    ) {
      return 'admissions';
    }
    if (p.includes('/organizations') || p.includes('/branches')) {
      return 'organization';
    }
    if (p.includes('/users') || p.includes('/auth')) {
      return 'auth';
    }
    if (p.includes('/system-settings')) {
      return 'system';
    }

    // Default fallback: first segment
    const segments = path
      .replace(/^\/v\d+\//, '/')
      .split('/')
      .filter(Boolean);
    return segments[0] || 'system';
  }

  /**
   * Helper for auditing: Infers the action based on rules lifecycle changes
   */
  private inferAuditAction(
    rule: any,
    eventType: 'create' | 'update' | 'delete',
    oldRule?: any,
  ): string {
    if (eventType === 'delete') {
      if (
        rule.startAt &&
        new Date(rule.startAt) > new Date() &&
        rule.isActive
      ) {
        return 'Maintenance Cancelled';
      }
      return 'Maintenance Disabled';
    }

    if (eventType === 'create') {
      if (rule.isActive) {
        if (rule.startAt && new Date(rule.startAt) > new Date()) {
          return 'Maintenance Scheduled';
        }
        if (!rule.allowWriteApis && rule.allowReadApis) {
          return 'Read-only Mode Enabled';
        }
        switch (rule.scopeType) {
          case 'GLOBAL':
            return 'Maintenance Enabled';
          case 'ORGANIZATION':
            return 'Organization Maintenance Enabled';
          case 'BRANCH':
            return 'Branch Maintenance Enabled';
          case 'MODULE':
            return 'Module Maintenance Enabled';
          case 'FEATURE':
            return 'Feature Maintenance Enabled';
        }
      }
      return 'Maintenance Disabled';
    }

    // update
    if (oldRule) {
      if (oldRule.isActive && !rule.isActive) {
        if (rule.startAt && new Date(rule.startAt) > new Date()) {
          return 'Maintenance Cancelled';
        }
        switch (rule.scopeType) {
          case 'MODULE':
            return 'Module Maintenance Disabled';
          case 'FEATURE':
            return 'Feature Maintenance Disabled';
          default:
            return 'Maintenance Disabled';
        }
      }
      if (!oldRule.isActive && rule.isActive) {
        if (rule.startAt && new Date(rule.startAt) > new Date()) {
          return 'Maintenance Scheduled';
        }
        switch (rule.scopeType) {
          case 'GLOBAL':
            return 'Maintenance Enabled';
          case 'ORGANIZATION':
            return 'Organization Maintenance Enabled';
          case 'BRANCH':
            return 'Branch Maintenance Enabled';
          case 'MODULE':
            return 'Module Maintenance Enabled';
          case 'FEATURE':
            return 'Feature Maintenance Enabled';
        }
      }
      if (
        rule.title !== oldRule.title ||
        rule.shortMessage !== oldRule.shortMessage ||
        rule.description !== oldRule.description
      ) {
        return 'Custom Message Updated';
      }
      if (!rule.allowWriteApis && oldRule.allowWriteApis) {
        return 'Read-only Mode Enabled';
      }
    }

    return 'Maintenance Updated';
  }

  /**
   * Resolves the active maintenance rule (if any) matching the scope parameters
   */
  async resolveActiveRule(
    context: MaintenanceCheckContext,
    path: string,
    featureName?: string,
  ): Promise<any | null> {
    const activeRules = await this.getActiveRules();
    const now = new Date();
    const rules = activeRules.filter((r) => this.isRuleCurrentlyActive(r, now));
    if (rules.length === 0) return null;

    const moduleName = this.inferModuleFromPath(path);

    let resolvedRule = rules.find((r) => r.scopeType === 'GLOBAL');

    if (!resolvedRule && context.organizationId) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'ORGANIZATION' &&
          r.scopeId === context.organizationId,
      );
    }
    if (!resolvedRule && context.branchId) {
      resolvedRule = rules.find(
        (r) => r.scopeType === 'BRANCH' && r.scopeId === context.branchId,
      );
    }
    if (!resolvedRule && moduleName) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'MODULE' &&
          r.scopeId?.toLowerCase() === moduleName.toLowerCase(),
      );
    }
    if (!resolvedRule && featureName) {
      resolvedRule = rules.find(
        (r) =>
          r.scopeType === 'FEATURE' &&
          r.scopeId?.toLowerCase() === featureName.toLowerCase(),
      );
    }

    return resolvedRule;
  }
}
