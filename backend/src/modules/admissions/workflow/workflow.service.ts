import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionApplicationStatus,
  Applicant,
  Prisma,
  RoleType,
} from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaTransactionClient } from '@/infrastructure/database/prisma-transaction.types';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { PersonService } from '@/modules/identity/person/person.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { ApplicantWorkflowEvent } from '@/common/events';
import { ResourceScope, scopedWhere } from '@/common/scope/resource-scope';
import { ChecklistService } from '@/modules/documents/checklist.service';
import { ADMISSION_CONFIG_KEYS } from '@/modules/configuration/config.registry';
import { PERMISSIONS } from '@/common/constants/permission.constants';
import { DRAFT_DELETE_ROLES } from '@/modules/admissions/applicant/applicant.service';
import {
  AdmissionConfigProvider,
  AdmissionPolicy,
} from '../admission-config.provider';
import {
  DIRECT_ADMISSION_PLAN,
  findRule,
  TRANSITIONS,
  TransitionGuard,
  TransitionRule,
  WorkflowAction,
} from './workflow.transitions';

/** Who is asking, and with what authority. */
export interface WorkflowActor {
  userId?: string | null;
  role?: string | null;
  /** The scheduled sweep. Bypasses the permission check, never the state machine. */
  system?: boolean;
}

export interface TransitionRequest {
  action: WorkflowAction;
  remarks?: string | null;
  /**
   * Set only by the operation that owns an `orchestratedOnly` transition.
   *
   * Deliberately absent from every DTO, so there is no request body that can
   * supply it. That is the whole mechanism: `admit` moves an applicant to
   * `ADMITTED`, which is only true if a Student, an Admission and an Enrollment
   * were written in the same transaction, and nothing reachable over HTTP can
   * assert that on its own.
   */
  orchestrated?: boolean;
  /**
   * The larger operation this transition is one step of, recorded on its
   * event and, when no reason was given, in its history remarks. Set only by
   * code — never by a DTO — exactly like `orchestrated`.
   */
  orchestration?: 'DIRECT_ADMISSION';
}

/** Why an offered action cannot be taken right now. */
export interface WorkflowActionBlocker {
  code: string;
  message: string;
  /** Present for `DOCUMENTS_INCOMPLETE`: the documents still owed. */
  missing?: unknown;
}

export interface WorkflowActionDescriptor {
  action: WorkflowAction;
  /** The state the action leads to. */
  to: AdmissionApplicationStatus;
  remarks: 'REQUIRED' | 'OPTIONAL';
  /** Whether the caller holds the action's permission. */
  permitted: boolean;
  /** Guard failures as of now. Re-checked, under lock, when the action runs. */
  blockedBy: WorkflowActionBlocker[];
  /** Permitted and unblocked. */
  available: boolean;
  /**
   * Which operation performs it: the generic transition endpoint, or the
   * admit operation (the only one that may reach ADMITTED).
   */
  via: 'TRANSITION' | 'ADMIT';
}

export interface WorkflowActionsResult {
  applicantId: string;
  status: AdmissionApplicationStatus;
  profile: AdmissionPolicy['workflowProfile'];
  /** The instant the policy was resolved for: submission, or now for a draft. */
  policyAsOf: Date;
  actions: WorkflowActionDescriptor[];
  directAdmission: {
    /** Whether the profile offers direct admission at all. */
    offered: boolean;
    /** Whether it can start from the current state. */
    fromCurrentState: boolean;
    /** Whether the caller holds every permission the walked steps need. */
    permitted: boolean;
    available: boolean;
  };
  /**
   * Deleting a draft — not a transition (nothing enters the workflow), but
   * the only way to close one, so it is described here beside the actions.
   */
  deleteDraft: {
    /** The caller's role and permissions allow deleting an applicant. */
    permitted: boolean;
    /** Permitted, and the application is still a draft. */
    available: boolean;
  };
}

/** What a guard needs beyond the locked row. */
interface GuardContext {
  actor: WorkflowActor;
  /** Resolved once per transition, lazily, as of the application's submission. */
  policy: () => Promise<AdmissionPolicy>;
}

/** Every permission a direct admission exercises, across all walked steps. */
export const DIRECT_ADMISSION_PERMISSIONS: readonly string[] = [
  PERMISSIONS.Admissions.Update,
  PERMISSIONS.Admissions.Approve,
  PERMISSIONS.Student.Create,
];

/**
 * The applicant state machine.
 *
 * One method drives every transition, human or scheduled, because the moment
 * there are two paths one of them stops writing history. The expiry sweep calls
 * exactly this with `system: true`.
 *
 * Every transition is: lock, re-read, validate, mutate, historise, outbox — in
 * one transaction, in that order. The lock comes first because a state check
 * against an unlocked read is a guess: `findUnique` takes no lock, so two
 * registrars approving at the same moment both see UNDER_REVIEW and both pass.
 *
 * See docs/planning/student-admission-enrollment-architecture.md §17.
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLock: RowLockService,
    private readonly outbox: OutboxPublisher,
    private readonly persons: PersonService,
    private readonly authorization: AuthorizationService,
    private readonly config: AdmissionConfigProvider,
    private readonly checklist: ChecklistService,
  ) {}

  /**
   * Apply an action to an application.
   *
   * The caller names a *verb*, never a destination. `{ action: 'approve' }`
   * rather than `{ newStatus: 'APPROVED' }`: the engine owns where each action
   * leads, so a client cannot invent a path — and in particular cannot ask for
   * `ADMITTED`, which has no rule at all until Phase 5.
   */
  async transition(
    applicantId: string,
    request: TransitionRequest,
    scope: ResourceScope,
    actor: WorkflowActor,
    tx?: PrismaTransactionClient,
  ): Promise<Applicant> {
    const rule = findRule(request.action);

    if (!rule) {
      throw new BadRequestException({
        error: 'INVALID_TRANSITION',
        message: `Unknown workflow action '${String(request.action)}'.`,
        action: request.action,
      });
    }

    if (rule.systemOnly && !actor.system) {
      throw new ForbiddenException({
        error: 'SYSTEM_ACTION',
        message: 'That action is performed by the system, not by a user.',
      });
    }

    if (rule.orchestratedOnly && !request.orchestrated) {
      // The status alone is not the operation. Admitting means a Student, an
      // Admission and an Enrollment exist; flipping the column without them
      // would record an outcome the rest of the database cannot support.
      throw new BadRequestException({
        error: 'ORCHESTRATED_TRANSITION',
        message:
          'Admission is not a status change. It creates a student, an admission and an enrolment together — use the admit operation.',
        action: request.action,
      });
    }

    this.assertRemarks(rule, request.remarks);
    await this.assertPermitted(rule, actor);

    try {
      return await this.runTransition(
        applicantId,
        request,
        rule,
        scope,
        actor,
        tx,
      );
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  /**
   * Join the caller's transaction, or open one.
   *
   * `admit()` owns a transaction that has already written three rows by the
   * time it gets here; opening a second one would put the status change outside
   * it, so a later failure would leave an applicant marked admitted with the
   * student rolled back underneath them.
   */
  private async runTransition(
    applicantId: string,
    request: TransitionRequest,
    rule: TransitionRule,
    scope: ResourceScope,
    actor: WorkflowActor,
    tx?: PrismaTransactionClient,
  ): Promise<Applicant> {
    const run = async (tx: PrismaTransactionClient) => {
      // Lock first, decide second. Under READ COMMITTED, FOR UPDATE re-reads the
      // row after a blocking transaction commits, so the loser of a race sees
      // the *new* state and fails the guard rather than overwriting the winner.
      const locked = await this.rowLock.lockRow(tx, {
        table: 'Applicant',
        id: applicantId,
        scope: {
          organizationId: scope.organizationId,
          branchId: scope.branchId,
        },
        columns: [
          'admissionStatus',
          'deletedAt',
          'personId',
          'programId',
          'quotaId',
          'categoryId',
          'offerExpiresAt',
          'academicYearId',
          'submittedAt',
        ],
      });

      if (!locked || locked.deletedAt !== null) {
        // Out of scope is indistinguishable from absent, deliberately.
        throw new NotFoundException('Applicant not found');
      }

      const current = locked.admissionStatus as AdmissionApplicationStatus;

      if (!rule.from.includes(current)) {
        throw new BadRequestException({
          error: 'INVALID_TRANSITION',
          message: `Cannot ${request.action} an application in state ${current}.`,
          from: current,
          action: request.action,
          allowedFrom: rule.from,
        });
      }

      const context = this.guardContext(actor, scope, locked);
      await this.assertGuards(rule, locked, scope, tx, context);

      const data: Record<string, unknown> = {
        admissionStatus: rule.to,
        updatedBy: actor.userId ?? null,
      };

      const now = new Date();
      for (const column of rule.timestamps ?? []) {
        data[column] =
          column === 'offerExpiresAt'
            ? this.offerDeadline(
                (await context.policy()).offerValidityDays,
                now,
              )
            : now;
      }
      if (rule.actorColumn) {
        data[rule.actorColumn] = actor.userId ?? null;
      }

      // Submission is the one transition that also establishes identity. It
      // happens here, inside the same transaction and after the lock, so a
      // Person is never resolved for an application that then fails to move.
      if (rule.action === WorkflowAction.SUBMIT) {
        data.personId = await this.resolvePersonForSubmission(
          applicantId,
          scope,
          tx,
        );
      }

      const updated = await tx.applicant.update({
        where: { id: applicantId },
        data,
      });

      await tx.workflowHistory.create({
        data: {
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          entityType: 'APPLICANT',
          entityId: applicantId,
          oldStatus: current,
          newStatus: rule.to,
          actionType: rule.action,
          remarks:
            request.remarks?.trim() ||
            (request.orchestration === 'DIRECT_ADMISSION'
              ? 'Recorded as part of a direct admission.'
              : null),
          actionBy: actor.system ? 'SYSTEM' : (actor.userId ?? 'SYSTEM'),
        },
      });

      // Named per transition rather than a generic `applicant.updated`, so a
      // report can tell an approval from a rejection without reconstructing
      // meaning from field diffs.
      await this.outbox.enqueue(
        new ApplicantWorkflowEvent(
          {
            applicantId,
            organizationId: scope.organizationId,
            branchId: scope.branchId,
            action: rule.action,
            fromStatus: current,
            toStatus: rule.to,
            ...(request.orchestration
              ? { orchestration: request.orchestration }
              : {}),
          },
          rule.event,
          rule.severity ? { severity: rule.severity } : undefined,
        ),
        tx,
      );

      return updated;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /** Transition history for one application, scoped. */
  async getHistory(applicantId: string, scope: ResourceScope) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
      select: { id: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    return this.prisma.workflowHistory.findMany({
      where: {
        entityType: 'APPLICANT',
        entityId: applicantId,
        organizationId: scope.organizationId,
        branchId: scope.branchId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * The actions legal from an application's current state, for this caller,
   * under the policy that governs it — the read contract the UI renders from.
   *
   * Guards are evaluated by the same code the transition runs, against an
   * unlocked read: the answer is advice, accurate as of now. The transition
   * re-evaluates everything under the row lock, so this endpoint can never be
   * what authorizes an action.
   */
  async describeActions(
    applicantId: string,
    scope: ResourceScope,
    actor: WorkflowActor,
  ): Promise<WorkflowActionsResult> {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
      select: {
        id: true,
        admissionStatus: true,
        personId: true,
        programId: true,
        quotaId: true,
        categoryId: true,
        offerExpiresAt: true,
        academicYearId: true,
        submittedAt: true,
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    const row = applicant as unknown as Record<string, unknown>;
    const context = this.guardContext(actor, scope, row);
    const policy = await context.policy();
    const status = applicant.admissionStatus;

    const permissionCache = new Map<string, Promise<boolean>>();
    const holds = (permission: string) => {
      if (!permissionCache.has(permission)) {
        permissionCache.set(
          permission,
          actor.userId && actor.role
            ? this.authorization.hasPermission(
                actor.userId,
                actor.role as RoleType,
                permission,
              )
            : Promise.resolve(false),
        );
      }
      return permissionCache.get(permission)!;
    };

    const actions: WorkflowActionDescriptor[] = [];
    for (const rule of TRANSITIONS) {
      if (!rule.from.includes(status) || rule.systemOnly) continue;

      const blockedBy: WorkflowActionBlocker[] = [];
      for (const guard of rule.guards ?? []) {
        try {
          await this.evaluateGuard(
            guard,
            rule,
            row,
            scope,
            this.prisma,
            context,
          );
        } catch (error) {
          if (!(error instanceof HttpException)) throw error;
          blockedBy.push(this.blockerOf(error));
        }
      }

      const permitted = await holds(rule.permission);
      actions.push({
        action: rule.action,
        to: rule.to,
        remarks: rule.remarks,
        permitted,
        blockedBy,
        available: permitted && blockedBy.length === 0,
        via: rule.orchestratedOnly ? 'ADMIT' : 'TRANSITION',
      });
    }

    const offered = policy.workflowProfile === 'SIMPLE_ADMISSION';
    const fromCurrentState = DIRECT_ADMISSION_PLAN[status] !== undefined;
    const permitted = (
      await Promise.all(DIRECT_ADMISSION_PERMISSIONS.map(holds))
    ).every(Boolean);

    const deletePermitted =
      (DRAFT_DELETE_ROLES as readonly string[]).includes(actor.role ?? '') &&
      (await holds(PERMISSIONS.Admissions.Delete));

    return {
      applicantId: applicant.id,
      status,
      profile: policy.workflowProfile,
      policyAsOf: policy.asOf,
      actions,
      directAdmission: {
        offered,
        fromCurrentState,
        permitted,
        available: offered && fromCurrentState && permitted,
      },
      deleteDraft: {
        permitted: deletePermitted,
        available: deletePermitted && status === 'DRAFT',
      },
    };
  }

  /**
   * Every document requirement that binds an application and where it stands
   * on each — computed by the same matching rules the guard enforces, so the
   * screen and the engine cannot disagree.
   */
  async describeChecklist(applicantId: string, scope: ResourceScope) {
    const applicant = await this.prisma.applicant.findFirst({
      where: { id: applicantId, ...scopedWhere(scope), deletedAt: null },
      select: {
        id: true,
        admissionStatus: true,
        personId: true,
        programId: true,
        quotaId: true,
        categoryId: true,
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found');
    }

    const items = await this.checklist.describe(
      {
        applicantId: applicant.id,
        branchId: scope.branchId,
        personId: applicant.personId,
        programId: applicant.programId,
        quotaId: applicant.quotaId,
        categoryId: applicant.categoryId,
      },
      scope.organizationId,
    );

    return {
      applicantId: applicant.id,
      status: applicant.admissionStatus,
      items,
      outstandingMandatory: items.filter((i) => i.isMandatory && !i.satisfied)
        .length,
    };
  }

  /** The effective policy for an application: as of its submission, or now. */
  async policyFor(
    scope: ResourceScope,
    submittedAt: Date | null,
  ): Promise<AdmissionPolicy> {
    return this.config.policy(
      { organizationId: scope.organizationId, branchId: scope.branchId },
      submittedAt ?? new Date(),
    );
  }

  // -------------------------------------------------------------------------

  /**
   * Name the rule the database enforced.
   *
   * `applicant_one_active` fires when two applications for the same person, in
   * the same branch and year, are submitted at once — the second loses the race
   * at commit rather than at the guard, because the guard cannot see a row that
   * has not committed yet. That is a legitimate outcome and deserves a 409, not
   * a leaked `P2002` naming an index the caller has never heard of.
   */
  private translateConstraint(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = String(
        (error.meta as { target?: string | string[] } | undefined)?.target ??
          '',
      );

      if (
        target.includes('applicant_one_active') ||
        target.includes('personId')
      ) {
        return new ConflictException({
          error: 'DUPLICATE_ACTIVE_APPLICATION',
          message:
            'This person already has a live application to this branch for this academic year.',
        });
      }
    }

    return error;
  }

  /**
   * Blank is not a reason.
   *
   * Checking `remarks != null` passes `""` and `"   "`, which is how a
   * mandatory-reason field becomes a mandatory-keystroke field.
   */
  private assertRemarks(rule: TransitionRule, remarks?: string | null): void {
    if (rule.remarks !== 'REQUIRED') return;
    if (remarks && remarks.trim().length > 0) return;

    throw new BadRequestException({
      error: 'REMARKS_REQUIRED',
      message: `A reason is required to ${rule.action} an application.`,
      action: rule.action,
    });
  }

  private async assertPermitted(
    rule: TransitionRule,
    actor: WorkflowActor,
  ): Promise<void> {
    if (actor.system) return;

    if (!actor.userId || !actor.role) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'This action requires an authenticated user.',
      });
    }

    const permitted = await this.authorization.hasPermission(
      actor.userId,
      actor.role as RoleType,
      rule.permission,
    );

    if (!permitted) {
      throw new ForbiddenException({
        error: 'ForbiddenException',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  private async assertGuards(
    rule: TransitionRule,
    locked: Record<string, unknown>,
    scope: ResourceScope,
    tx: PrismaTransactionClient,
    context: GuardContext,
  ): Promise<void> {
    for (const guard of rule.guards ?? []) {
      await this.evaluateGuard(guard, rule, locked, scope, tx, context);
    }
  }

  /**
   * Policy is resolved as of the moment the application entered the workflow
   * — its `submittedAt` — so an administrator changing the profile or a
   * switch mid-cycle never changes the process an in-flight application is
   * following. A draft has not entered it yet and follows the current policy.
   */
  private guardContext(
    actor: WorkflowActor,
    scope: ResourceScope,
    row: Record<string, unknown>,
  ): GuardContext {
    let policy: Promise<AdmissionPolicy> | undefined;
    return {
      actor,
      policy: () =>
        (policy ??= this.policyFor(
          scope,
          (row.submittedAt as Date | null) ?? null,
        )),
    };
  }

  private blockerOf(error: HttpException): WorkflowActionBlocker {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      return {
        code: typeof body.error === 'string' ? body.error : error.name,
        message:
          typeof body.message === 'string' ? body.message : error.message,
        ...(body.missing !== undefined ? { missing: body.missing } : {}),
      };
    }
    return { code: error.name, message: String(response) };
  }

  private async evaluateGuard(
    guard: TransitionGuard,
    rule: TransitionRule,
    locked: Record<string, unknown>,
    scope: ResourceScope,
    tx: PrismaTransactionClient,
    context: GuardContext,
  ): Promise<void> {
    const expiresAt = locked.offerExpiresAt as Date | null;

    switch (guard) {
      case 'OFFER_NOT_EXPIRED':
        // Read under the lock, never from a value the caller passed in. The
        // deadline is inclusive of its own instant: an offer is live *until*
        // it expires, so `now === expiresAt` still confirms. The sweep uses the
        // complementary strict comparison, so exactly one of the two can win.
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          throw new BadRequestException({
            error: 'OFFER_EXPIRED',
            message: 'The offer has expired and can no longer be confirmed.',
            offerExpiresAt: expiresAt,
          });
        }
        return;

      case 'OFFER_EXPIRED':
        if (!expiresAt || expiresAt.getTime() >= Date.now()) {
          throw new BadRequestException({
            error: 'OFFER_NOT_EXPIRED',
            message: 'The offer has not expired.',
          });
        }
        return;

      case 'DEFERMENT_ENABLED':
        // Keeps its original error code: clients already branch on it.
        if (!(await context.policy()).allowDeferment) {
          throw new BadRequestException({
            error: 'DEFERMENT_DISABLED',
            message: 'Deferment is not enabled for this institution.',
            policy: ADMISSION_CONFIG_KEYS.allowDeferment,
          });
        }
        return;

      case 'WAITLIST_ENABLED':
      case 'FEE_STEP_ENABLED':
      case 'DOCUMENT_REQUEST_ENABLED': {
        const policy = await context.policy();
        const [enabled, key] =
          guard === 'WAITLIST_ENABLED'
            ? [policy.waitlistEnabled, ADMISSION_CONFIG_KEYS.waitlistEnabled]
            : guard === 'FEE_STEP_ENABLED'
              ? [policy.feeStepEnabled, ADMISSION_CONFIG_KEYS.feeStepEnabled]
              : [
                  policy.documentRequestEnabled,
                  ADMISSION_CONFIG_KEYS.documentRequestEnabled,
                ];
        if (!enabled) {
          throw new BadRequestException({
            error: 'POLICY_DISABLED',
            message: `The ${rule.action} step is turned off for this branch's admission process.`,
            policy: key,
            action: rule.action,
          });
        }
        return;
      }

      case 'DOCUMENT_CHECKLIST_SATISFIED': {
        // "Which stage" is the transition's own — the applicant's current
        // status and the state it is about to enter — never an invented
        // ordering over the whole state graph, which stays owned by
        // workflow.transitions.ts, not the Documents module.
        const current = locked.admissionStatus as AdmissionApplicationStatus;
        await this.assertChecklist(locked, scope, [current, rule.to], tx);
        return;
      }

      case 'VERIFIED_REVIEW_CHECKLIST':
        if ((await context.policy()).workflowProfile !== 'VERIFIED_ADMISSION') {
          return;
        }
        await this.assertChecklist(
          locked,
          scope,
          [
            AdmissionApplicationStatus.SUBMITTED,
            AdmissionApplicationStatus.UNDER_REVIEW,
          ],
          tx,
        );
        return;

      case 'DISTINCT_REVIEWER': {
        if (context.actor.system) return;
        if ((await context.policy()).workflowProfile !== 'VERIFIED_ADMISSION') {
          return;
        }
        // The reviewer is whoever most recently put the application under
        // review, read from the persisted history — never from the request.
        const reviewStart = await tx.workflowHistory.findFirst({
          where: {
            entityType: 'APPLICANT',
            entityId: locked.id as string,
            organizationId: scope.organizationId,
            actionType: {
              in: [WorkflowAction.START_REVIEW, WorkflowAction.FORCE_REOPEN],
            },
          },
          orderBy: { timestamp: 'desc' },
          select: { actionBy: true },
        });
        if (
          reviewStart?.actionBy &&
          reviewStart.actionBy === context.actor.userId
        ) {
          throw new ForbiddenException({
            error: 'MAKER_CHECKER_VIOLATION',
            message:
              'You started the review of this application, so a different user must approve it.',
          });
        }
        return;
      }

      default: {
        const exhaustive: never = guard;
        throw new Error(`Unhandled transition guard: ${String(exhaustive)}`);
      }
    }
  }

  private async assertChecklist(
    locked: Record<string, unknown>,
    scope: ResourceScope,
    stages: AdmissionApplicationStatus[],
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const { satisfied, missing } = await this.checklist.isSatisfied(
      {
        applicantId: locked.id as string,
        branchId: scope.branchId,
        personId: (locked.personId as string | null) ?? null,
        programId: (locked.programId as string | null) ?? null,
        quotaId: (locked.quotaId as string | null) ?? null,
        categoryId: (locked.categoryId as string | null) ?? null,
      },
      stages,
      scope.organizationId,
      tx,
    );
    if (!satisfied) {
      throw new ConflictException({
        error: 'DOCUMENTS_INCOMPLETE',
        message: 'One or more mandatory documents are missing or unverified.',
        missing,
      });
    }
  }

  /** The deadline is written once, at issue, and never recomputed. */
  private offerDeadline(days: number, issuedAt: Date): Date {
    return new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Place the applicant in the identity index at submission.
   *
   * Delegated entirely to Phase 1. Admissions does no matching of its own —
   * a second implementation would drift from the first, and the one that
   * decides "same human" has to be singular.
   *
   * Candidate warnings are deliberately not blocking: twins share an address, a
   * phone, a date of birth and their parents, so refusing on similarity refuses
   * real applicants.
   */
  private async resolvePersonForSubmission(
    applicantId: string,
    scope: ResourceScope,
    tx: PrismaTransactionClient,
  ): Promise<string> {
    const applicant = await tx.applicant.findFirstOrThrow({
      where: { id: applicantId },
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        dob: true,
        primaryMobile: true,
        aadhaarNo: true,
        programId: true,
        personId: true,
      },
    });

    if (!applicant.programId) {
      throw new BadRequestException({
        error: 'PROGRAM_REQUIRED',
        message:
          'A programme must be selected before the application can be submitted.',
      });
    }

    if (applicant.personId) {
      return applicant.personId;
    }

    const resolved = await this.resolveIdentity(applicant, scope, tx);

    if (resolved.warnings.length > 0) {
      this.logger.log(
        `Applicant ${applicantId} submitted with ${resolved.warnings.length} identity candidate(s) for review.`,
      );
    }

    return resolved.personId;
  }

  /**
   * Hand the identifiers to Phase 1, government identifier included.
   *
   * The government identifier is the only *deterministic* key: it is what turns
   * "this looks like the same child" into "this is the same child", and it is
   * what makes the one-live-application-per-person rule bite at all. Resolving
   * on demographics alone never returns an existing Person — by design, because
   * twins share every demographic signal — so without this the rule would only
   * ever catch rows written by hand.
   *
   * A stored identifier that fails validation does not block the submission. The
   * column predates the identity module and may hold anything; refusing to accept
   * an application because a legacy field is malformed would be a new failure
   * introduced by a cleanup, so it degrades to demographic resolution and says so
   * in the log.
   */
  private async resolveIdentity(
    applicant: {
      firstName: string;
      middleName: string | null;
      lastName: string;
      dob: Date;
      primaryMobile: string | null;
      aadhaarNo: string | null;
    },
    scope: ResourceScope,
    tx: PrismaTransactionClient,
  ) {
    const identifiers = {
      firstName: applicant.firstName,
      middleName: applicant.middleName,
      lastName: applicant.lastName,
      dob: applicant.dob,
      phone: applicant.primaryMobile,
    };

    if (!applicant.aadhaarNo) {
      return this.persons.resolve(scope.organizationId, identifiers, tx);
    }

    try {
      return await this.persons.resolve(
        scope.organizationId,
        { ...identifiers, governmentId: applicant.aadhaarNo },
        tx,
      );
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;

      // Never log the identifier itself.
      this.logger.warn(
        'Stored government identifier failed validation; resolving on demographics instead.',
      );
      return this.persons.resolve(scope.organizationId, identifiers, tx);
    }
  }
}
