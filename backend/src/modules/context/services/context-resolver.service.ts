import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { LoggerService } from '@/common/logger/logger.service';
import { RoleType } from '@/generated/client';
import { ContextDiscoveryService } from './context-discovery.service';
import { ContextValidatorService } from './context-validator.service';
import {
  ResolvedContextResult,
  ExecutionContextPayload,
} from '../interfaces/execution-context.interface';
import {
  ContextValidationFailedEvent,
  ContextAccessDeniedEvent,
  ContextSelectionRequiredEvent,
} from '@/common/events/context.events';

export interface ResolveContextInput {
  user: {
    id: string;
    role: RoleType;
    organizationId?: string | null;
    branchId?: string | null;
  };
  headers: {
    organizationId?: string | null;
    branchId?: string | null;
    academicYearId?: string | null;
  };
  requestId?: string | null;
}

@Injectable()
export class ContextResolverService {
  constructor(
    private readonly discoveryService: ContextDiscoveryService,
    private readonly validatorService: ContextValidatorService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ContextResolverService.name);
  }

  /**
   * Best-effort resolution for a workspace that is still being bootstrapped.
   *
   * During setup the tenant hierarchy is partially built: the organization may
   * exist while no branch does, and so on. `resolveContext` treats every one of
   * those states as an error, which is correct once the workspace is live but
   * would make the setup flow itself unreachable.
   *
   * This resolves each level only as far as the data allows and leaves the rest
   * null. It never throws for absent records, and it never widens access —
   * discovery is still scoped to what the user may see.
   */
  async resolveBootstrapContext(
    input: ResolveContextInput,
  ): Promise<ExecutionContextPayload> {
    const { user } = input;
    const {
      id: userId,
      role,
      organizationId: userOrgId,
      branchId: userBranchId,
    } = user;

    const empty: ExecutionContextPayload = {
      organizationId: null,
      branchId: null,
      academicYearId: null,
      programId: null,
      departmentId: null,
      campusId: null,
      branch: null,
      academicYear: null,
    };

    const orgDiscovery = await this.discoveryService.discoverContexts(
      userId,
      role,
      userOrgId,
      userBranchId,
    );

    // More than one candidate is not a bootstrap state; leave the scope unset
    // rather than guessing on the user's behalf.
    if (orgDiscovery.availableOrganizations.length !== 1) {
      return empty;
    }

    const organizationId = orgDiscovery.availableOrganizations[0].id;

    const branchDiscovery = await this.discoveryService.discoverContexts(
      userId,
      role,
      userOrgId,
      userBranchId,
      organizationId,
    );

    if (branchDiscovery.availableBranches.length !== 1) {
      return { ...empty, organizationId };
    }

    const branch = branchDiscovery.availableBranches[0];

    const ayDiscovery = await this.discoveryService.discoverContexts(
      userId,
      role,
      userOrgId,
      userBranchId,
      organizationId,
      branch.id,
    );

    const academicYear =
      ayDiscovery.availableAcademicYears.find(
        (ay) => ay.isSelected || ay.isActive,
      ) ?? ayDiscovery.availableAcademicYears[0];

    this.logger.log(
      `Bootstrap context resolved: user=${userId}, org=${organizationId}, branch=${branch.id}, ay=${academicYear?.id ?? 'none'}`,
    );

    return {
      ...empty,
      organizationId,
      branchId: branch.id,
      branch: {
        id: branch.id,
        organizationId: branch.organizationId,
        name: branch.name,
        code: branch.code,
        institutionType: branch.institutionType,
        isActive: branch.isActive,
        isDeleted: false,
      },
      academicYearId: academicYear?.id ?? null,
      academicYear: academicYear
        ? {
            id: academicYear.id,
            branchId: academicYear.branchId,
            name: academicYear.name,
            startDate: academicYear.startDate,
            endDate: academicYear.endDate,
            isActive: academicYear.isActive,
            isSelected: academicYear.isSelected,
            isLocked: academicYear.isLocked,
          }
        : null,
    };
  }

  /**
   * Deterministic 3-Priority Execution Context Resolution Algorithm
   */
  async resolveContext(
    input: ResolveContextInput,
  ): Promise<ResolvedContextResult> {
    const startTime = Date.now();
    const { user, headers, requestId } = input;
    const {
      id: userId,
      role,
      organizationId: userOrgId,
      branchId: userBranchId,
    } = user;

    const rawOrgHeader = headers.organizationId?.trim() || null;
    const rawBranchHeader = headers.branchId?.trim() || null;
    const rawAyHeader = headers.academicYearId?.trim() || null;

    const hasHeaders = Boolean(rawOrgHeader || rawBranchHeader || rawAyHeader);

    try {
      // ---------------------------------------------------------
      // PRIORITY 1: Header Resolution
      // ---------------------------------------------------------
      if (hasHeaders) {
        // Step 1: Resolve Organization from header or fallback
        let targetOrgId = rawOrgHeader;

        if (!targetOrgId) {
          // If org header omitted, try finding user's single available org
          const discovery = await this.discoveryService.discoverContexts(
            userId,
            role,
            userOrgId,
            userBranchId,
          );
          if (discovery.availableOrganizations.length === 1) {
            targetOrgId = discovery.availableOrganizations[0].id;
          } else if (discovery.availableOrganizations.length > 1) {
            return await this.triggerSelectionRequired(
              userId,
              role,
              discovery,
              requestId,
            );
          } else {
            throw new BadRequestException(
              'No active organization available for user.',
            );
          }
        }

        const org = await this.validatorService.validateOrganization(
          targetOrgId,
          userId,
          role,
          userOrgId,
        );

        // Step 2: Resolve Branch from header or fallback
        let targetBranchId = rawBranchHeader;

        if (!targetBranchId) {
          const discovery = await this.discoveryService.discoverContexts(
            userId,
            role,
            userOrgId,
            userBranchId,
            org.id,
          );
          if (discovery.availableBranches.length === 1) {
            targetBranchId = discovery.availableBranches[0].id;
          } else if (discovery.availableBranches.length > 1) {
            return await this.triggerSelectionRequired(
              userId,
              role,
              discovery,
              requestId,
            );
          } else {
            throw new BadRequestException(
              `No active branch available for organization '${org.name}'.`,
            );
          }
        }

        const branch = await this.validatorService.validateBranch(
          targetBranchId,
          org.id,
          userId,
          role,
          userBranchId,
        );

        // Step 3: Resolve Academic Year from header or fallback
        let targetAyId = rawAyHeader;

        if (!targetAyId) {
          const discovery = await this.discoveryService.discoverContexts(
            userId,
            role,
            userOrgId,
            userBranchId,
            org.id,
            branch.id,
          );
          const activeOrSelectedAy = discovery.availableAcademicYears.find(
            (ay) => ay.isSelected || ay.isActive,
          );
          if (activeOrSelectedAy) {
            targetAyId = activeOrSelectedAy.id;
          } else if (discovery.availableAcademicYears.length > 0) {
            targetAyId = discovery.availableAcademicYears[0].id;
          } else {
            throw new BadRequestException(
              `No active academic year found for branch '${branch.name}'.`,
            );
          }
        }

        const ay = await this.validatorService.validateAcademicYear(
          targetAyId,
          branch.id,
        );

        // Discovery for hydrated response
        const discovery = await this.discoveryService.discoverContexts(
          userId,
          role,
          userOrgId,
          userBranchId,
          org.id,
          branch.id,
        );

        const executionContext: ExecutionContextPayload = {
          organizationId: org.id,
          branchId: branch.id,
          academicYearId: ay.id,
          programId: null,
          departmentId: null,
          campusId: null,
          branch: {
            id: branch.id,
            organizationId: branch.organizationId,
            name: branch.name,
            code: branch.code,
            institutionType: branch.institutionType,
            isActive: branch.isActive,
            isDeleted: branch.isDeleted,
          },
          academicYear: {
            id: ay.id,
            branchId: ay.branchId,
            name: ay.name,
            startDate: ay.startDate,
            endDate: ay.endDate,
            isActive: ay.isActive,
            isSelected: ay.isSelected,
            isLocked: ay.isLocked,
          },
        };

        const duration = Date.now() - startTime;
        this.logger.log(
          `Context resolved [HEADER]: user=${userId}, role=${role}, org=${org.id}, branch=${branch.id}, ay=${ay.id} (${duration}ms)`,
        );

        return {
          context: executionContext,
          source: 'HEADER',
          discovery,
        };
      }

      // ---------------------------------------------------------
      // PRIORITY 2: Automatic Resolution
      // ---------------------------------------------------------
      const discovery = await this.discoveryService.discoverContexts(
        userId,
        role,
        userOrgId,
        userBranchId,
      );

      // Check organization resolution
      if (discovery.availableOrganizations.length === 0) {
        throw new BadRequestException(
          'No active organization available for user.',
        );
      }

      let selectedOrgId: string | null = null;
      if (discovery.availableOrganizations.length === 1) {
        selectedOrgId = discovery.availableOrganizations[0].id;
      } else {
        // Multiple organizations without header -> Priority 3 selection required
        return await this.triggerSelectionRequired(
          userId,
          role,
          discovery,
          requestId,
        );
      }

      // Branch resolution for selectedOrgId
      const branchDiscovery = await this.discoveryService.discoverContexts(
        userId,
        role,
        userOrgId,
        userBranchId,
        selectedOrgId,
      );

      if (branchDiscovery.availableBranches.length === 0) {
        throw new BadRequestException(
          `No active branch available for organization '${selectedOrgId}'.`,
        );
      }

      let selectedBranchId: string | null = null;
      if (branchDiscovery.availableBranches.length === 1) {
        selectedBranchId = branchDiscovery.availableBranches[0].id;
      } else {
        // Multiple branches without header -> Selection Required
        return await this.triggerSelectionRequired(
          userId,
          role,
          branchDiscovery,
          requestId,
        );
      }

      // Academic Year resolution for selectedBranchId
      const ayDiscovery = await this.discoveryService.discoverContexts(
        userId,
        role,
        userOrgId,
        userBranchId,
        selectedOrgId,
        selectedBranchId,
      );

      const activeOrSelectedAy = ayDiscovery.availableAcademicYears.find(
        (ay) => ay.isSelected || ay.isActive,
      );

      let selectedAyId: string | null = null;
      if (activeOrSelectedAy) {
        selectedAyId = activeOrSelectedAy.id;
      } else if (ayDiscovery.availableAcademicYears.length === 1) {
        selectedAyId = ayDiscovery.availableAcademicYears[0].id;
      } else if (ayDiscovery.availableAcademicYears.length > 1) {
        selectedAyId = ayDiscovery.availableAcademicYears[0].id;
      } else {
        throw new BadRequestException(
          `No academic year configured for branch '${selectedBranchId}'.`,
        );
      }

      // Full validation pass
      const full = await this.validatorService.validateFullContext(
        selectedOrgId,
        selectedBranchId,
        selectedAyId,
        userId,
        role,
        userOrgId,
        userBranchId,
      );

      const executionContext: ExecutionContextPayload = {
        organizationId: full.organization.id,
        branchId: full.branch.id,
        academicYearId: full.academicYear.id,
        programId: null,
        departmentId: null,
        campusId: null,
        branch: {
          id: full.branch.id,
          organizationId: full.branch.organizationId,
          name: full.branch.name,
          code: full.branch.code,
          institutionType: full.branch.institutionType,
          isActive: full.branch.isActive,
          isDeleted: full.branch.isDeleted,
        },
        academicYear: {
          id: full.academicYear.id,
          branchId: full.academicYear.branchId,
          name: full.academicYear.name,
          startDate: full.academicYear.startDate,
          endDate: full.academicYear.endDate,
          isActive: full.academicYear.isActive,
          isSelected: full.academicYear.isSelected,
          isLocked: full.academicYear.isLocked,
        },
      };

      const duration = Date.now() - startTime;
      const source =
        discovery.availableOrganizations.length === 1 &&
        branchDiscovery.availableBranches.length === 1
          ? 'SINGLE_CONTEXT'
          : 'AUTO';

      this.logger.log(
        `Context resolved [${source}]: user=${userId}, role=${role}, org=${full.organization.id}, branch=${full.branch.id}, ay=${full.academicYear.id} (${duration}ms)`,
      );

      return {
        context: executionContext,
        source,
        discovery: ayDiscovery,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof ForbiddenException) {
        await this.eventBus.publish(
          new ContextAccessDeniedEvent({
            userId,
            role,
            targetOrganizationId: rawOrgHeader,
            targetBranchId: rawBranchHeader,
            targetAcademicYearId: rawAyHeader,
            reason: (error as Error).message,
            requestId,
          }),
        );
      } else {
        await this.eventBus.publish(
          new ContextValidationFailedEvent({
            userId,
            role,
            reason: (error as Error).message,
            organizationId: rawOrgHeader,
            branchId: rawBranchHeader,
            academicYearId: rawAyHeader,
            requestId,
          }),
        );
      }

      throw error;
    }
  }

  /**
   * Helper to emit audit event and throw 409 Conflict CONTEXT_SELECTION_REQUIRED
   */
  private async triggerSelectionRequired(
    userId: string,
    role: RoleType,
    discovery: any,
    requestId?: string | null,
  ): Promise<never> {
    await this.eventBus.publish(
      new ContextSelectionRequiredEvent({
        userId,
        role,
        availableOrganizationsCount: discovery.availableOrganizations.length,
        availableBranchesCount: discovery.availableBranches.length,
        availableAcademicYearsCount: discovery.availableAcademicYears.length,
        requestId,
      }),
    );

    throw new ConflictException({
      statusCode: 409,
      error: 'CONTEXT_SELECTION_REQUIRED',
      message: 'Execution context must be selected.',
      availableOrganizations: discovery.availableOrganizations,
      availableBranches: discovery.availableBranches,
      availableAcademicYears: discovery.availableAcademicYears,
    });
  }
}
