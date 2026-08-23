import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoggerService } from '@/common/logger/logger.service';
import { OrganizationStatus } from '@/generated/client';
import {
  SETUP_ALLOWED_ACTIONS,
  SETUP_RESOURCES,
  SetupResource,
  WorkspaceSetupStage,
  WorkspaceSetupStatus,
} from './workspace-setup.types';

const WORKSPACE_STATE_SCOPE = 'GLOBAL';

/**
 * Owns the workspace bootstrap state.
 *
 * A fresh installation has no Organization, Branch or Academic Year, but the
 * authenticated API is scoped by all three. Without an explicit bootstrap
 * state, the first administrator cannot create the very records the API
 * requires them to have — a deadlock.
 *
 * Progress through setup is **derived** from the data, so it cannot drift from
 * reality. Only the terminal transition is persisted, which makes completing
 * setup an explicit, attributable act.
 */
@Injectable()
export class WorkspaceSetupService {
  /**
   * Latches once the workspace is initialized.
   *
   * Completion is irreversible, so caching it needs no invalidation. This keeps
   * the steady state at zero extra queries per request; the uncached path runs
   * only during first-run setup, which is rare and short-lived.
   */
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(WorkspaceSetupService.name);
  }

  /**
   * Whether the tenant-header contract is in force.
   */
  async isInitialized(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    const state = await this.prisma.workspaceState.findUnique({
      where: { scope: WORKSPACE_STATE_SCOPE },
      select: { initializedAt: true },
    });

    if (state?.initializedAt) {
      this.initialized = true;
    }

    return this.initialized;
  }

  async getStatus(): Promise<WorkspaceSetupStatus> {
    const [state, present] = await Promise.all([
      this.prisma.workspaceState.findUnique({
        where: { scope: WORKSPACE_STATE_SCOPE },
        select: { initializedAt: true },
      }),
      this.findPresentResources(),
    ]);

    const missingResources = this.missingFrom(present);
    const initializedAt = state?.initializedAt ?? null;

    if (initializedAt) {
      this.initialized = true;
    }

    return {
      setupRequired: !initializedAt,
      setupStage: this.stageFor(missingResources, Boolean(initializedAt)),
      missingResources,
      completedResources: present,
      allowedActions: initializedAt ? [] : SETUP_ALLOWED_ACTIONS,
      initializedAt: initializedAt?.toISOString() ?? null,
    };
  }

  /**
   * Marks the workspace initialized.
   *
   * Idempotent, and refuses while any required resource is still missing —
   * completing setup early would re-create the deadlock in a harder-to-diagnose
   * form, with the header contract enforced against records that do not exist.
   */
  async markInitialized(userId: string | null): Promise<WorkspaceSetupStatus> {
    const current = await this.getStatus();

    if (!current.setupRequired) {
      return current;
    }

    if (current.missingResources.length > 0) {
      throw new ConflictException({
        error: 'SETUP_INCOMPLETE',
        message:
          'Workspace setup cannot be completed while resources are missing.',
        setupStage: current.setupStage,
        missingResources: current.missingResources,
      });
    }

    await this.prisma.workspaceState.upsert({
      where: { scope: WORKSPACE_STATE_SCOPE },
      update: { initializedAt: new Date(), initializedById: userId },
      create: {
        scope: WORKSPACE_STATE_SCOPE,
        initializedAt: new Date(),
        initializedById: userId,
      },
    });

    this.initialized = true;
    this.logger.log(
      `Workspace marked initialized by user ${userId ?? 'unknown'}`,
    );

    return this.getStatus();
  }

  /**
   * Which bootstrap resources already exist.
   *
   * Uses the same activity filters as context resolution, so a workspace can
   * never report itself ready while holding only records the resolver would
   * reject.
   */
  private async findPresentResources(): Promise<SetupResource[]> {
    const [systemSettings, organization, branch, academicYear] =
      await Promise.all([
        this.prisma.systemSetting.findFirst({ select: { id: true } }),
        this.prisma.organization.findFirst({
          where: { status: OrganizationStatus.ACTIVE },
          select: { id: true },
        }),
        this.prisma.branch.findFirst({
          where: { isActive: true, isDeleted: false },
          select: { id: true },
        }),
        this.prisma.academicYear.findFirst({
          where: { isDeleted: false },
          select: { id: true },
        }),
      ]);

    const present: SetupResource[] = [];
    if (systemSettings) present.push('SYSTEM_SETTINGS');
    if (organization) present.push('ORGANIZATION');
    if (branch) present.push('BRANCH');
    if (academicYear) present.push('ACADEMIC_YEAR');
    return present;
  }

  private missingFrom(present: SetupResource[]): SetupResource[] {
    return SETUP_RESOURCES.filter((resource) => !present.includes(resource));
  }

  private stageFor(
    missing: SetupResource[],
    initialized: boolean,
  ): WorkspaceSetupStage {
    if (initialized) {
      return 'COMPLETED';
    }
    // The stage names the next resource to create; with none missing the
    // workspace is waiting to be marked initialized.
    return missing[0] ?? 'FINALIZE';
  }
}
