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
  ContextDiscoveryResult,
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

export interface ResolveContextOptions {
  /**
   * Whether an **ambiguous** scope must be settled before the request may run.
   *
   * `true` (the default) is the documented Priority 3 behaviour: a user who can
   * see several organizations, or several branches, and supplied no header to
   * choose between them, gets `409 CONTEXT_SELECTION_REQUIRED` with the
   * candidates.
   *
   * `false` is for routes that do not operate inside one tenant — see
   * `@AllowUnresolvedContext()`. The ambiguous level and everything below it
   * resolve to `null` instead. Nothing else changes: a supplied header is still
   * validated and a cross-tenant one is still refused, so this narrows what the
   * request can reach, never widens it.
   */
  selectionRequired?: boolean;
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
    options: ResolveContextOptions = {},
  ): Promise<ResolvedContextResult> {
    const startTime = Date.now();
    const selectionRequired = options.selectionRequired ?? true;
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

        // A client that named a branch has already named its organization: the
        // hierarchy is strict, so the levels above the most specific header are
        // implied, not ambiguous. Asking such a client to select an
        // organization asks it to repeat what it just said — and answering 409
        // because it did not is how a scoped request from a correctly
        // configured client still failed.
        //
        // This is a lookup, not a grant: `validateOrganization` and
        // `validateBranch` run immediately below on whatever it produces, so a
        // caller naming a branch outside their tenant is still refused.
        if (!targetOrgId) {
          targetOrgId = await this.deriveOrganizationId(
            rawBranchHeader,
            rawAyHeader,
          );
        }

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
            if (!selectionRequired) {
              return this.unresolved(discovery);
            }
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

        // An academic year names its branch, for the same reason.
        if (!targetBranchId && rawAyHeader) {
          targetBranchId =
            await this.validatorService.findAcademicYearBranchId(rawAyHeader);
        }

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
          } else if (
            discovery.availableBranches.length > 1 &&
            selectionRequired
          ) {
            return await this.triggerSelectionRequired(
              userId,
              role,
              discovery,
              requestId,
            );
          }
          // An organization with no branch leaves the scope unset rather than
          // failing, for the same reason as the academic year below: throwing
          // made a newly created organization unusable, including for the
          // request that would have created its first branch.
        }

        const branch = targetBranchId
          ? await this.validatorService.validateBranch(
              targetBranchId,
              org.id,
              userId,
              role,
              userBranchId,
            )
          : null;

        // Step 3: Resolve Academic Year from header or fallback
        let targetAyId = rawAyHeader;

        if (!targetAyId && branch) {
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
          }
          // A branch with no academic year leaves the scope unset rather than
          // failing. Throwing here made a newly created branch unusable: every
          // request against it failed, including the one that would have
          // created its first academic year. Routes that genuinely need the
          // year declare @RequireAcademicYear() and AcademicYearGuard rejects
          // them; the rest are unaffected.
        }

        const ay =
          targetAyId && branch
            ? await this.validatorService.validateAcademicYear(
                targetAyId,
                branch.id,
              )
            : null;

        // Discovery for hydrated response
        const discovery = await this.discoveryService.discoverContexts(
          userId,
          role,
          userOrgId,
          userBranchId,
          org.id,
          branch?.id,
        );

        const executionContext: ExecutionContextPayload = {
          organizationId: org.id,
          branchId: branch?.id ?? null,
          academicYearId: ay?.id ?? null,
          programId: null,
          departmentId: null,
          campusId: null,
          branch: branch
            ? {
                id: branch.id,
                organizationId: branch.organizationId,
                name: branch.name,
                code: branch.code,
                institutionType: branch.institutionType,
                isActive: branch.isActive,
                isDeleted: branch.isDeleted,
              }
            : null,
          academicYear: ay
            ? {
                id: ay.id,
                branchId: ay.branchId,
                name: ay.name,
                startDate: ay.startDate,
                endDate: ay.endDate,
                isActive: ay.isActive,
                isSelected: ay.isSelected,
                isLocked: ay.isLocked,
              }
            : null,
        };

        const duration = Date.now() - startTime;
        this.logger.log(
          `Context resolved [HEADER]: user=${userId}, role=${role}, org=${org.id}, branch=${branch?.id ?? 'none'}, ay=${ay?.id ?? 'none'} (${duration}ms)`,
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
      } else if (!selectionRequired) {
        // The route does not operate inside one tenant, so ambiguity is not an
        // error for it — leave the whole scope unset.
        return this.unresolved(discovery);
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

      // An organization with no branch resolves to an organization-only scope
      // rather than failing; BranchGuard rejects the routes that require one.
      // Absence is not ambiguity: there is nothing for the client to select, so
      // answering CONTEXT_SELECTION_REQUIRED with an empty candidate list would
      // put it in a loop it cannot leave — which is what a newly created
      // organization did to every request made against it.
      let selectedBranchId: string | null = null;
      if (branchDiscovery.availableBranches.length === 1) {
        selectedBranchId = branchDiscovery.availableBranches[0].id;
      } else if (
        branchDiscovery.availableBranches.length > 1 &&
        selectionRequired
      ) {
        // Multiple branches without header -> Selection Required
        return await this.triggerSelectionRequired(
          userId,
          role,
          branchDiscovery,
          requestId,
        );
      }

      // Academic Year resolution for selectedBranchId
      const ayDiscovery = selectedBranchId
        ? await this.discoveryService.discoverContexts(
            userId,
            role,
            userOrgId,
            userBranchId,
            selectedOrgId,
            selectedBranchId,
          )
        : branchDiscovery;

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
      }
      // As on the header path, a branch with no academic year leaves the scope
      // unset instead of failing the whole request.

      const organization = await this.validatorService.validateOrganization(
        selectedOrgId,
        userId,
        role,
        userOrgId,
      );

      const branch = selectedBranchId
        ? await this.validatorService.validateBranch(
            selectedBranchId,
            organization.id,
            userId,
            role,
            userBranchId,
          )
        : null;

      const academicYear =
        selectedAyId && branch
          ? await this.validatorService.validateAcademicYear(
              selectedAyId,
              branch.id,
            )
          : null;

      const full = { organization, branch, academicYear };

      const executionContext: ExecutionContextPayload = {
        organizationId: full.organization.id,
        branchId: full.branch?.id ?? null,
        academicYearId: full.academicYear?.id ?? null,
        programId: null,
        departmentId: null,
        campusId: null,
        branch: full.branch
          ? {
              id: full.branch.id,
              organizationId: full.branch.organizationId,
              name: full.branch.name,
              code: full.branch.code,
              institutionType: full.branch.institutionType,
              isActive: full.branch.isActive,
              isDeleted: full.branch.isDeleted,
            }
          : null,
        academicYear: full.academicYear
          ? {
              id: full.academicYear.id,
              branchId: full.academicYear.branchId,
              name: full.academicYear.name,
              startDate: full.academicYear.startDate,
              endDate: full.academicYear.endDate,
              isActive: full.academicYear.isActive,
              isSelected: full.academicYear.isSelected,
              isLocked: full.academicYear.isLocked,
            }
          : null,
      };

      const duration = Date.now() - startTime;
      const source =
        discovery.availableOrganizations.length === 1 &&
        branchDiscovery.availableBranches.length === 1
          ? 'SINGLE_CONTEXT'
          : 'AUTO';

      this.logger.log(
        `Context resolved [${source}]: user=${userId}, role=${role}, org=${full.organization.id}, branch=${full.branch?.id ?? 'none'}, ay=${full.academicYear?.id ?? 'none'} (${duration}ms)`,
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
   * The organization implied by the most specific scope header supplied.
   *
   * Branch → organization, or academic year → branch → organization. Returns
   * `null` when nothing was named or the id does not resolve, which puts the
   * request back on the ordinary discovery path rather than inventing an error.
   *
   * Deriving is never a permission: every id this produces goes through
   * `validateOrganization` / `validateBranch`, which is where tenant boundaries
   * are enforced.
   */
  private async deriveOrganizationId(
    branchHeader: string | null,
    academicYearHeader: string | null,
  ): Promise<string | null> {
    const branchId =
      branchHeader ??
      (academicYearHeader
        ? await this.validatorService.findAcademicYearBranchId(
            academicYearHeader,
          )
        : null);

    if (!branchId) {
      return null;
    }

    return this.validatorService.findBranchOrganizationId(branchId);
  }

  /**
   * An ambiguous scope, left unresolved for a route that does not need one.
   *
   * No event is published and nothing is thrown: for these routes an ambiguous
   * scope is an ordinary outcome, not a failure. The discovery result is still
   * returned, so `/auth/me` can report the candidates the caller must choose
   * between before calling anything that is scoped.
   */
  private unresolved(discovery: ContextDiscoveryResult): ResolvedContextResult {
    return {
      context: {
        organizationId: null,
        branchId: null,
        academicYearId: null,
        programId: null,
        departmentId: null,
        campusId: null,
        branch: null,
        academicYear: null,
      },
      source: 'UNRESOLVED',
      discovery,
    };
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
