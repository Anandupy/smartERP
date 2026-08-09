import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { AdmissionConfigProvider } from '../admission-config.provider';
import {
  findRule,
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
}

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
  ): Promise<Applicant> {
    const rule = findRule(request.action);

    if (!rule) {
      throw new BadRequestException({
        error: 'INVALID_TRANSITION',
        message:
          request.action === WorkflowAction.ADMIT
            ? 'Admission is not a status change. It creates a student, an admission and an enrolment together, and is not yet available.'
            : `Unknown workflow action '${String(request.action)}'.`,
        action: request.action,
      });
    }

    if (rule.systemOnly && !actor.system) {
      throw new ForbiddenException({
        error: 'SYSTEM_ACTION',
        message: 'That action is performed by the system, not by a user.',
      });
    }

    this.assertRemarks(rule, request.remarks);
    await this.assertPermitted(rule, actor);

    try {
      return await this.runTransition(applicantId, request, rule, scope, actor);
    } catch (error) {
      throw this.translateConstraint(error);
    }
  }

  private async runTransition(
    applicantId: string,
    request: TransitionRequest,
    rule: TransitionRule,
    scope: ResourceScope,
    actor: WorkflowActor,
  ): Promise<Applicant> {
    return this.prisma.$transaction(async (tx) => {
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
          'offerExpiresAt',
          'academicYearId',
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

      await this.assertGuards(rule, locked, scope);

      const data: Record<string, unknown> = {
        admissionStatus: rule.to,
        updatedBy: actor.userId ?? null,
      };

      const now = new Date();
      for (const column of rule.timestamps ?? []) {
        data[column] =
          column === 'offerExpiresAt' ? this.offerDeadline(scope, now) : now;
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
          remarks: request.remarks?.trim() || null,
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
          },
          rule.event,
          rule.severity ? { severity: rule.severity } : undefined,
        ),
        tx,
      );

      return updated;
    });
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
  ): Promise<void> {
    for (const guard of rule.guards ?? []) {
      await this.evaluateGuard(guard, locked, scope);
    }
  }

  private async evaluateGuard(
    guard: TransitionGuard,
    locked: Record<string, unknown>,
    scope: ResourceScope,
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
        if (
          !this.config.defermentEnabled({
            organizationId: scope.organizationId,
            branchId: scope.branchId,
          })
        ) {
          throw new BadRequestException({
            error: 'DEFERMENT_DISABLED',
            message: 'Deferment is not enabled for this institution.',
          });
        }
        return;

      case 'DOCUMENT_CHECKLIST_SATISFIED':
        // The Document module (S3) does not exist. The blueprint's rule is to
        // enforce the checklist *if* the requirement system is present and not
        // to invent one otherwise — a fabricated check would pass every time
        // while looking like a control. The guard is wired so S3 satisfies it
        // by supplying the service, changing nothing here.
        return;

      default: {
        const exhaustive: never = guard;
        throw new Error(`Unhandled transition guard: ${String(exhaustive)}`);
      }
    }
  }

  private offerDeadline(scope: ResourceScope, issuedAt: Date): Date {
    const days = this.config.offerValidityDays(
      { organizationId: scope.organizationId, branchId: scope.branchId },
      issuedAt,
    );
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
