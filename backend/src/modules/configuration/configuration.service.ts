import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigScope, Prisma, RoleType } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { ConfigChangedEvent } from '@/common/events/config.events';
import {
  CONFIG_DEFINITIONS,
  CONFIG_WRITE_PERMISSION,
  ConfigDefinitionSpec,
  findDefinition,
} from './config.registry';

/** Where a value is being resolved. */
export interface ConfigResolutionScope {
  organizationId: string;
  branchId?: string | null;
}

/** Which tier answered a resolution. */
export type ConfigSource = 'BRANCH' | 'ORGANIZATION' | 'SYSTEM' | 'DEFAULT';

export interface ResolvedConfigValue<T = unknown> {
  key: string;
  value: T;
  source: ConfigSource;
  /** Null when the registry default answered. */
  version: number | null;
  effectiveFrom: Date | null;
}

/** The scope a write targets — always derived from the resolved request context. */
export interface ConfigWriteTarget {
  scopeType: ConfigScope;
  /** Null exactly for SYSTEM. */
  scopeId: string | null;
}

export interface ConfigActor {
  userId: string;
  role: string;
}

/**
 * F2's resolution and write path — the minimum of the configuration engine
 * that admission policy needs, built to F2's design rather than beside it.
 *
 * Resolution is `resolve(key, scope, asOf)`: BRANCH, then ORGANIZATION, then
 * SYSTEM, then the registry default, among rows whose window contains `asOf`.
 * It never fails for an absent value. It *does* fail for a stored value the
 * registry rejects — a corrupted policy row must stop the operation, not
 * quietly fall back to whatever is more permissive.
 *
 * Writes are append-only: the current row at the target scope is closed at
 * `now` and its successor opens at the same instant, so the windows abut and
 * never overlap — which the database also enforces.
 *
 * Not built here, and recorded in docs/modules/configuration.md: caching
 * (F2 D6 / Q1 — resolution is one indexed query), future-dated changes, and
 * long-running-job version binding (D4).
 */
@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxPublisher,
    private readonly authorization: AuthorizationService,
  ) {}

  /** Every registered definition. */
  definitions(): readonly ConfigDefinitionSpec[] {
    return CONFIG_DEFINITIONS;
  }

  /**
   * Resolve several keys for one scope and instant, in one query.
   *
   * `asOf` is the governing date of the decision being made — for an
   * application already in the workflow, the moment it entered it — so a
   * later change of policy never rewrites an earlier decision.
   */
  async resolveMany(
    keys: readonly string[],
    scope: ConfigResolutionScope,
    asOf: Date = new Date(),
    client: PrismaTransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, ResolvedConfigValue>> {
    const specs = keys.map((key) => this.requireDefinition(key));

    const scopeFilters: Prisma.ConfigValueWhereInput[] = [
      { scopeType: ConfigScope.SYSTEM, scopeId: null },
      { scopeType: ConfigScope.ORGANIZATION, scopeId: scope.organizationId },
    ];
    if (scope.branchId) {
      scopeFilters.push({
        scopeType: ConfigScope.BRANCH,
        scopeId: scope.branchId,
      });
    }

    const rows = await client.configValue.findMany({
      where: {
        definitionKey: { in: specs.map((s) => s.key) },
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        AND: [{ OR: scopeFilters }],
      },
      select: {
        definitionKey: true,
        scopeType: true,
        value: true,
        version: true,
        effectiveFrom: true,
      },
    });

    const precedence: Record<ConfigScope, number> = {
      BRANCH: 3,
      ORGANIZATION: 2,
      SYSTEM: 1,
    };

    const resolved = new Map<string, ResolvedConfigValue>();

    for (const spec of specs) {
      const winner = rows
        .filter((row) => row.definitionKey === spec.key)
        .sort((a, b) => precedence[b.scopeType] - precedence[a.scopeType])[0];

      if (!winner) {
        resolved.set(spec.key, {
          key: spec.key,
          value: spec.defaultValue,
          source: 'DEFAULT',
          version: null,
          effectiveFrom: null,
        });
        continue;
      }

      const checked = spec.validate(winner.value);
      if (!checked.ok) {
        // Fail closed. Falling back to the default here would let a damaged row
        // silently change how admissions are processed.
        this.logger.error(
          `Stored configuration for ${spec.key} at ${winner.scopeType} (v${winner.version}) is invalid: ${checked.reason}`,
        );
        throw new InternalServerErrorException({
          error: 'CONFIGURATION_INVALID',
          message: `The configured value of ${spec.key} is invalid and cannot be applied. An administrator must correct it.`,
          key: spec.key,
        });
      }

      resolved.set(spec.key, {
        key: spec.key,
        value: checked.value,
        source: winner.scopeType,
        version: winner.version,
        effectiveFrom: winner.effectiveFrom,
      });
    }

    return resolved;
  }

  /** History of one key at one exact scope, newest first. */
  async history(key: string, target: ConfigWriteTarget) {
    this.requireDefinition(key);
    return this.prisma.configValue.findMany({
      where: {
        definitionKey: key,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
      },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        definitionKey: true,
        scopeType: true,
        scopeId: true,
        value: true,
        version: true,
        effectiveFrom: true,
        effectiveTo: true,
        setBy: true,
        setAt: true,
        reason: true,
      },
    });
  }

  /** Set a value at a scope, superseding the one in force there. */
  async set(
    key: string,
    target: ConfigWriteTarget,
    rawValue: unknown,
    reason: string | null | undefined,
    actor: ConfigActor,
  ) {
    const spec = this.requireDefinition(key);
    await this.assertMayWrite(spec, target, actor);

    const checked = spec.validate(rawValue);
    if (!checked.ok) {
      throw new BadRequestException({
        error: 'CONFIG_VALUE_INVALID',
        message: `${key} ${checked.reason}.`,
        key,
      });
    }
    const trimmedReason = this.requireReason(spec, reason);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.syncDefinition(tx, spec);

        const { current, at } = await this.closeCurrent(
          tx,
          key,
          target,
          new Date(),
        );
        const version = (await this.latestVersion(tx, key, target)) + 1;

        const created = await tx.configValue.create({
          data: {
            definitionKey: key,
            scopeType: target.scopeType,
            scopeId: target.scopeId,
            value: checked.value as Prisma.InputJsonValue,
            // Opens exactly where its predecessor closed: no gap, no overlap.
            effectiveFrom: at,
            version,
            setBy: actor.userId,
            setAt: at,
            reason: trimmedReason,
          },
        });

        await this.outbox.enqueue(
          new ConfigChangedEvent({
            key,
            scopeType: target.scopeType,
            scopeId: target.scopeId,
            oldValue: current?.value ?? null,
            newValue: checked.value,
            version,
            reason: trimmedReason,
            changedBy: actor.userId,
            ...this.eventScope(target),
          }),
          tx,
        );

        return created;
      });
    } catch (error) {
      throw this.translate(error, key);
    }
  }

  /** Clear the value at a scope; resolution falls through to the tier above. */
  async clear(
    key: string,
    target: ConfigWriteTarget,
    reason: string | null | undefined,
    actor: ConfigActor,
  ): Promise<{ cleared: boolean }> {
    const spec = this.requireDefinition(key);
    await this.assertMayWrite(spec, target, actor);
    const trimmedReason = this.requireReason(spec, reason);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { current } = await this.closeCurrent(
          tx,
          key,
          target,
          new Date(),
        );
        if (!current) return { cleared: false };

        await this.outbox.enqueue(
          new ConfigChangedEvent({
            key,
            scopeType: target.scopeType,
            scopeId: target.scopeId,
            oldValue: current.value,
            newValue: null,
            version: null,
            reason: trimmedReason,
            changedBy: actor.userId,
            ...this.eventScope(target),
          }),
          tx,
        );

        return { cleared: true };
      });
    } catch (error) {
      throw this.translate(error, key);
    }
  }

  // ---------------------------------------------------------------------------

  private requireDefinition(key: string): ConfigDefinitionSpec {
    const spec = findDefinition(key);
    if (!spec) {
      throw new NotFoundException({
        error: 'CONFIG_KEY_NOT_FOUND',
        message: `There is no configuration key named '${key}'.`,
        key,
      });
    }
    return spec;
  }

  private requireReason(
    spec: ConfigDefinitionSpec,
    reason: string | null | undefined,
  ): string | null {
    const trimmed = reason?.trim() || null;
    if (spec.isVersioned && !trimmed) {
      throw new BadRequestException({
        error: 'CONFIG_REASON_REQUIRED',
        message: `Changing ${spec.key} is a policy change and requires a reason.`,
        key: spec.key,
      });
    }
    return trimmed;
  }

  /**
   * The scope must be one the key allows, and the actor must hold the key's
   * category permission. SYSTEM is the platform default for every tenant and
   * belongs to SUPER_ADMIN alone.
   */
  private async assertMayWrite(
    spec: ConfigDefinitionSpec,
    target: ConfigWriteTarget,
    actor: ConfigActor,
  ): Promise<void> {
    if (!spec.allowedScopes.includes(target.scopeType)) {
      throw new BadRequestException({
        error: 'CONFIG_SCOPE_NOT_ALLOWED',
        message: `${spec.key} cannot be set at ${target.scopeType} scope.`,
        allowedScopes: spec.allowedScopes,
      });
    }

    if (
      target.scopeType === ConfigScope.SYSTEM &&
      actor.role !== RoleType.SUPER_ADMIN
    ) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'Only a super administrator may change the platform default.',
      });
    }

    // An organization-wide value reshapes every branch, so it is an
    // organization administrator's call even when a branch administrator has
    // been granted the category permission for their own branch.
    if (
      target.scopeType === ConfigScope.ORGANIZATION &&
      actor.role !== RoleType.SUPER_ADMIN &&
      actor.role !== RoleType.ORG_ADMIN
    ) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message:
          'Only an organization administrator may change organization-wide configuration.',
      });
    }

    const permitted = await this.authorization.hasPermission(
      actor.userId,
      actor.role as RoleType,
      CONFIG_WRITE_PERMISSION[spec.category],
    );
    if (!permitted) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'You do not have permission to change this configuration.',
      });
    }
  }

  /**
   * Close the row in force at the target scope.
   *
   * Returns it, and the instant it closed — which is when a successor opens.
   * Normally that is `now`; if the current row opened at or after `now` (two
   * changes inside one clock tick), it closes a millisecond after it opened,
   * so every window keeps a positive length and stays ordered.
   */
  private async closeCurrent(
    tx: PrismaTransactionClient,
    key: string,
    target: ConfigWriteTarget,
    now: Date,
  ) {
    const current = await tx.configValue.findFirst({
      where: {
        definitionKey: key,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        effectiveTo: null,
      },
    });
    if (!current) return { current: null, at: now };

    const at =
      current.effectiveFrom.getTime() < now.getTime()
        ? now
        : new Date(current.effectiveFrom.getTime() + 1);

    // Conditional on still being open: of two concurrent writers only one
    // closes the row; the other inserts a second current row, which the
    // partial unique index refuses.
    const { count } = await tx.configValue.updateMany({
      where: { id: current.id, effectiveTo: null },
      data: { effectiveTo: at },
    });
    if (count === 0) {
      throw new ConflictException({
        error: 'CONFIG_CONCURRENT_UPDATE',
        message:
          'This configuration was changed by someone else. Reload and try again.',
      });
    }
    return { current, at };
  }

  private async latestVersion(
    tx: PrismaTransactionClient,
    key: string,
    target: ConfigWriteTarget,
  ): Promise<number> {
    const latest = await tx.configValue.findFirst({
      where: {
        definitionKey: key,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  /** Definitions ship with the code that reads them (F2 D8). */
  private async syncDefinition(
    tx: PrismaTransactionClient,
    spec: ConfigDefinitionSpec,
  ): Promise<void> {
    const data = {
      category: spec.category,
      valueType: spec.valueType,
      defaultValue: spec.defaultValue as Prisma.InputJsonValue,
      allowedScopes: spec.allowedScopes,
      isVersioned: spec.isVersioned,
      description: spec.description,
      isActive: true,
    };
    await tx.configDefinition.upsert({
      where: { key: spec.key },
      update: data,
      create: { key: spec.key, ...data },
    });
  }

  private eventScope(target: ConfigWriteTarget) {
    if (target.scopeType === ConfigScope.ORGANIZATION && target.scopeId) {
      return { organizationId: target.scopeId };
    }
    if (target.scopeType === ConfigScope.BRANCH && target.scopeId) {
      return { branchId: target.scopeId };
    }
    return {};
  }

  private translate(error: unknown, key: string): unknown {
    const message = error instanceof Error ? error.message : '';
    const isRace =
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002') ||
      message.includes('ConfigValue_current_key') ||
      message.includes('ConfigValue_no_overlapping_windows') ||
      message.includes('ConfigValue_window_check');

    if (isRace) {
      return new ConflictException({
        error: 'CONFIG_CONCURRENT_UPDATE',
        message: `${key} was changed at the same moment by another request. Reload and try again.`,
      });
    }
    return error;
  }
}
