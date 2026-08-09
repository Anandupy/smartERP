import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdmissionApplicationStatus as S } from '@/generated/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RowLockService } from '@/infrastructure/database/row-lock.service';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { PersonService } from '@/modules/identity/person/person.service';
import { AuthorizationService } from '@/modules/authorization/authorization.service';
import { WorkflowService } from '@/modules/admissions/workflow/workflow.service';
import { AdmissionConfigProvider } from '@/modules/admissions/admission-config.provider';
import {
  actionsFrom,
  findRule,
  statesWithNoExit,
  TERMINAL_STATES,
  TRANSITIONS,
  WorkflowAction,
} from '@/modules/admissions/workflow/workflow.transitions';
import { ResourceScope } from '@/common/scope/resource-scope';

const SCOPE: ResourceScope = {
  organizationId: 'org-1',
  branchId: 'branch-1',
  academicYearId: 'year-1',
};

const OTHER_BRANCH: ResourceScope = { ...SCOPE, branchId: 'branch-2' };
const ACTOR = { userId: 'user-1', role: 'BRANCH_ADMIN' };

describe('Applicant workflow', () => {
  let workflow: WorkflowService;
  let config: AdmissionConfigProvider;

  const rawQuery = jest.fn() as jest.Mock & { lockResult: unknown[] };
  rawQuery.lockResult = [];

  const resolvePerson = jest.fn().mockResolvedValue({
    personId: 'person-1',
    created: true,
    matchedByGovernmentId: false,
    warnings: [],
  });
  const hasPermission = jest.fn().mockResolvedValue(true);

  const mockPrisma: any = {
    applicant: {
      update: jest.fn().mockResolvedValue({ id: 'app-1' }),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'ob-1' }) },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    $queryRawUnsafe: rawQuery,
  };

  /** Put the applicant in a state, under the lock. */
  const inState = (status: S, extra: Record<string, unknown> = {}) => {
    rawQuery.lockResult = [
      {
        id: 'app-1',
        admissionStatus: status,
        deletedAt: null,
        personId: 'person-1',
        programId: 'prog-1',
        offerExpiresAt: null,
        academicYearId: 'year-1',
        ...extra,
      },
    ];
    mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
      firstName: 'Riya',
      middleName: null,
      lastName: 'Sharma',
      dob: new Date('2015-04-12'),
      primaryMobile: '9876543210',
      programId: 'prog-1',
      personId: (extra.personId as string) ?? 'person-1',
    });
  };

  beforeEach(async () => {
    rawQuery.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('FOR UPDATE') ? rawQuery.lockResult : []),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        AdmissionConfigProvider,
        // Real, because they are thin and the point is to exercise the wiring.
        RowLockService,
        OutboxPublisher,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PersonService, useValue: { resolve: resolvePerson } },
        { provide: AuthorizationService, useValue: { hasPermission } },
      ],
    }).compile();

    workflow = module.get(WorkflowService);
    config = module.get(AdmissionConfigProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    rawQuery.lockResult = [];
    hasPermission.mockResolvedValue(true);
  });

  // ---------------------------------------------------------------------------

  describe('the transition table', () => {
    /**
     * §102 — the table covers the enum.
     *
     * Catches the failure mode where somebody adds a state and forgets the
     * rules for it: without this, the new state is simply unreachable and
     * inescapable, and nothing says so.
     */
    it('accounts for every state in the enum', () => {
      const declared = Object.values(S);
      const reachable = new Set(TRANSITIONS.map((t) => t.to));
      const exitable = new Set(TRANSITIONS.flatMap((t) => t.from));

      for (const state of declared) {
        const isStart = state === S.DRAFT;
        const isTerminal = TERMINAL_STATES.includes(state);
        const accounted =
          isStart || isTerminal || reachable.has(state) || exitable.has(state);

        expect({ state, accounted }).toEqual({ state, accounted: true });
      }
    });

    it('leaves exactly four states with no way out', () => {
      // REJECTED and WITHDRAWN because a decision already communicated to the
      // candidate is not quietly reversible; ADMITTED because Phase 5 has not
      // built the only edge into it. DEFERRED is terminal for *this*
      // application by design — deferring to the next cycle produces a new
      // Applicant carrying `deferredFromApplicantId`, not a reopening of this
      // one, so the original stays as evidence of what was decided when.
      expect(statesWithNoExit().sort()).toEqual(
        [S.DEFERRED, S.ADMITTED, S.REJECTED, S.WITHDRAWN].sort(),
      );

      // The declared terminal set is the subset that is terminal permanently.
      expect(TERMINAL_STATES).not.toContain(S.DEFERRED);
    });

    it('has no rule producing ADMITTED', () => {
      // The single most important absence in the table: ADMITTED means a
      // Student, an Admission and an Enrolment exist, and a status-only edge
      // would produce it without any of them.
      expect(TRANSITIONS.filter((t) => t.to === S.ADMITTED)).toHaveLength(0);
      expect(findRule(WorkflowAction.ADMIT)).toBeUndefined();
    });

    it('gives every rule a permission and an event', () => {
      for (const rule of TRANSITIONS) {
        expect(rule.permission).toBeTruthy();
        expect(rule.event).toMatch(/^applicant\./);
      }
    });

    it('never lists a state as both source and destination of one rule', () => {
      for (const rule of TRANSITIONS) {
        expect(rule.from).not.toContain(rule.to);
      }
    });

    it('offers only CANCELLED a way back', () => {
      const reopeners = TRANSITIONS.filter((t) => t.to === S.UNDER_REVIEW);
      const sources = new Set(reopeners.flatMap((t) => t.from));
      expect(sources.has(S.CANCELLED)).toBe(true);
      // Reopening a rejection or a withdrawal would resurrect a decision the
      // candidate has already been told about.
      expect(sources.has(S.REJECTED)).toBe(false);
      expect(sources.has(S.WITHDRAWN)).toBe(false);
      expect(sources.has(S.ADMITTED)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------

  describe('legal transitions', () => {
    const legal: Array<[S, WorkflowAction, S]> = [
      [S.DRAFT, WorkflowAction.SUBMIT, S.SUBMITTED],
      [S.DRAFT, WorkflowAction.CANCEL, S.CANCELLED],
      [S.DRAFT, WorkflowAction.WITHDRAW, S.WITHDRAWN],
      [S.SUBMITTED, WorkflowAction.START_REVIEW, S.UNDER_REVIEW],
      [S.SUBMITTED, WorkflowAction.REJECT, S.REJECTED],
      [S.UNDER_REVIEW, WorkflowAction.REQUEST_DOCUMENTS, S.DOCUMENT_PENDING],
      [S.UNDER_REVIEW, WorkflowAction.REQUEST_FEE, S.FEE_PENDING],
      [S.UNDER_REVIEW, WorkflowAction.WAITLIST, S.WAITLISTED],
      [S.UNDER_REVIEW, WorkflowAction.APPROVE, S.APPROVED],
      [S.UNDER_REVIEW, WorkflowAction.REJECT, S.REJECTED],
      [S.DOCUMENT_PENDING, WorkflowAction.DOCUMENTS_RECEIVED, S.UNDER_REVIEW],
      [S.DOCUMENT_PENDING, WorkflowAction.APPROVE, S.APPROVED],
      [S.DOCUMENT_PENDING, WorkflowAction.REJECT, S.REJECTED],
      [S.FEE_PENDING, WorkflowAction.APPROVE, S.APPROVED],
      [S.FEE_PENDING, WorkflowAction.REJECT, S.REJECTED],
      [S.WAITLISTED, WorkflowAction.APPROVE, S.APPROVED],
      [S.WAITLISTED, WorkflowAction.REJECT, S.REJECTED],
      [S.APPROVED, WorkflowAction.CONFIRM_SEAT, S.SEAT_CONFIRMED],
      [S.APPROVED, WorkflowAction.CANCEL, S.CANCELLED],
      [S.APPROVED, WorkflowAction.WITHDRAW, S.WITHDRAWN],
      [S.SEAT_CONFIRMED, WorkflowAction.WITHDRAW, S.WITHDRAWN],
      [S.SEAT_CONFIRMED, WorkflowAction.CANCEL, S.CANCELLED],
      [S.CANCELLED, WorkflowAction.FORCE_REOPEN, S.UNDER_REVIEW],
    ];

    it.each(legal)('%s --%s--> %s', async (from, action, to) => {
      inState(from);
      mockPrisma.applicant.update.mockResolvedValue({
        id: 'app-1',
        admissionStatus: to,
      });

      await workflow.transition(
        'app-1',
        { action, remarks: 'because the test says so' },
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.applicant.update.mock.calls[0][0].data.admissionStatus).toBe(
        to,
      );
    });

    it('allows deferment only when configuration enables it', async () => {
      inState(S.APPROVED);

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.DEFER, remarks: 'family relocating' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'DEFERMENT_DISABLED' } });

      jest.spyOn(config, 'defermentEnabled').mockReturnValue(true);
      inState(S.APPROVED);
      mockPrisma.applicant.update.mockResolvedValue({ id: 'app-1' });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.DEFER, remarks: 'family relocating' },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('illegal transitions', () => {
    const illegal: Array<[S, WorkflowAction]> = [
      [S.DRAFT, WorkflowAction.APPROVE],
      [S.DRAFT, WorkflowAction.CONFIRM_SEAT],
      [S.DRAFT, WorkflowAction.START_REVIEW],
      [S.DRAFT, WorkflowAction.REJECT],
      [S.SUBMITTED, WorkflowAction.APPROVE],
      [S.SUBMITTED, WorkflowAction.CONFIRM_SEAT],
      [S.UNDER_REVIEW, WorkflowAction.CONFIRM_SEAT],
      [S.UNDER_REVIEW, WorkflowAction.SUBMIT],
      [S.APPROVED, WorkflowAction.SUBMIT],
      [S.APPROVED, WorkflowAction.START_REVIEW],
      [S.APPROVED, WorkflowAction.APPROVE],
      [S.APPROVED, WorkflowAction.REJECT],
      [S.SEAT_CONFIRMED, WorkflowAction.APPROVE],
      [S.SEAT_CONFIRMED, WorkflowAction.CONFIRM_SEAT],
      [S.REJECTED, WorkflowAction.APPROVE],
      [S.REJECTED, WorkflowAction.FORCE_REOPEN],
      [S.WITHDRAWN, WorkflowAction.APPROVE],
      [S.WITHDRAWN, WorkflowAction.FORCE_REOPEN],
      [S.ADMITTED, WorkflowAction.START_REVIEW],
      [S.ADMITTED, WorkflowAction.FORCE_REOPEN],
      [S.ADMITTED, WorkflowAction.CANCEL],
      [S.DEFERRED, WorkflowAction.CONFIRM_SEAT],
      [S.CANCELLED, WorkflowAction.APPROVE],
    ];

    it.each(illegal)('refuses %s --%s-->', async (from, action) => {
      inState(from);

      await expect(
        workflow.transition('app-1', { action, remarks: 'attempt' }, SCOPE, ACTOR),
      ).rejects.toMatchObject({ response: { error: 'INVALID_TRANSITION' } });

      // Refused before anything is written.
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
      expect(mockPrisma.workflowHistory.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('refuses a bare request to admit', async () => {
      inState(S.SEAT_CONFIRMED);

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.ADMIT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'INVALID_TRANSITION' } });
    });
  });

  // ---------------------------------------------------------------------------

  describe('locking and scope', () => {
    it('locks before reading state, with the scope in the lock', async () => {
      inState(S.DRAFT);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.SUBMIT },
        SCOPE,
        ACTOR,
      );

      const lock = rawQuery.mock.calls.find((c) =>
        String(c[0]).includes('FOR UPDATE'),
      );
      expect(lock).toBeDefined();
      expect(String(lock![0])).toContain('"Applicant"');
      expect(String(lock![0])).toContain('"organizationId"');
      expect(String(lock![0])).toContain('"branchId"');
    });

    it('treats an out-of-scope applicant as absent', async () => {
      rawQuery.lockResult = [];

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.SUBMIT },
          OTHER_BRANCH,
          ACTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('treats a soft-deleted applicant as absent', async () => {
      inState(S.DRAFT, { deletedAt: new Date() });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.SUBMIT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('permissions', () => {
    it('refuses when the actor lacks the transition permission', async () => {
      inState(S.UNDER_REVIEW);
      hasPermission.mockResolvedValue(false);

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('checks the permission the rule declares, not the route', async () => {
      inState(S.UNDER_REVIEW);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );
      expect(hasPermission).toHaveBeenCalledWith(
        'user-1',
        'BRANCH_ADMIN',
        'admissions.approve',
      );

      jest.clearAllMocks();
      hasPermission.mockResolvedValue(true);
      inState(S.SUBMITTED);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.REJECT, remarks: 'incomplete' },
        SCOPE,
        ACTOR,
      );
      expect(hasPermission).toHaveBeenCalledWith(
        'user-1',
        'BRANCH_ADMIN',
        'admissions.reject',
      );
    });

    it('refuses an anonymous caller', async () => {
      inState(S.DRAFT);
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.SUBMIT },
          SCOPE,
          { userId: null, role: null },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('keeps the system-only expiry action off the user surface', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() - 1000) });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.EXPIRE_OFFER },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'SYSTEM_ACTION' } });
    });

    it('lets the system act without a permission check', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() - 1000) });

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.EXPIRE_OFFER },
        SCOPE,
        { system: true },
      );

      expect(hasPermission).not.toHaveBeenCalled();
      expect(mockPrisma.workflowHistory.create.mock.calls[0][0].data.actionBy).toBe(
        'SYSTEM',
      );
    });
  });

  describe('remarks policy', () => {
    const requiring = TRANSITIONS.filter((t) => t.remarks === 'REQUIRED');

    it('requires a reason where the table says so', () => {
      // Encoded centrally rather than re-listed here: a second list is a second
      // thing to keep in step.
      expect(requiring.map((t) => t.action).sort()).toEqual(
        [
          WorkflowAction.REQUEST_DOCUMENTS,
          WorkflowAction.WAITLIST,
          WorkflowAction.DEFER,
          WorkflowAction.REJECT,
          WorkflowAction.WITHDRAW,
          WorkflowAction.CANCEL,
          WorkflowAction.FORCE_REOPEN,
        ].sort(),
      );
    });

    it.each(['', '   ', '\t\n', null, undefined])(
      'rejects %p as a reason',
      async (remarks) => {
        inState(S.SUBMITTED);

        await expect(
          workflow.transition(
            'app-1',
            { action: WorkflowAction.REJECT, remarks: remarks as string },
            SCOPE,
            ACTOR,
          ),
        ).rejects.toMatchObject({ response: { error: 'REMARKS_REQUIRED' } });
      },
    );

    it('accepts an optional reason being absent', async () => {
      inState(S.SUBMITTED);
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.START_REVIEW },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('trims what it stores', async () => {
      inState(S.SUBMITTED);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.REJECT, remarks: '  incomplete documents  ' },
        SCOPE,
        ACTOR,
      );
      expect(mockPrisma.workflowHistory.create.mock.calls[0][0].data.remarks).toBe(
        'incomplete documents',
      );
    });
  });

  describe('the offer', () => {
    it('stamps both ends of the window at approval', async () => {
      inState(S.UNDER_REVIEW);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      const data = mockPrisma.applicant.update.mock.calls[0][0].data;
      expect(data.approvedAt).toBeInstanceOf(Date);
      expect(data.offerIssuedAt).toBeInstanceOf(Date);
      expect(data.offerExpiresAt).toBeInstanceOf(Date);
      expect(data.approvedBy).toBe('user-1');
      expect(
        (data.offerExpiresAt as Date).getTime() -
          (data.offerIssuedAt as Date).getTime(),
      ).toBe(15 * 24 * 60 * 60 * 1000);
    });

    it('takes the window length from configuration, not a constant', async () => {
      jest.spyOn(config, 'offerValidityDays').mockReturnValue(7);
      inState(S.UNDER_REVIEW);

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      const data = mockPrisma.applicant.update.mock.calls[0][0].data;
      expect(
        (data.offerExpiresAt as Date).getTime() -
          (data.offerIssuedAt as Date).getTime(),
      ).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('refuses to confirm a lapsed offer', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() - 60_000) });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.CONFIRM_SEAT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'OFFER_EXPIRED' } });
    });

    it('confirms a live offer', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() + 60_000) });
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.CONFIRM_SEAT },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses to expire an offer that is still live', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() + 60_000) });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.EXPIRE_OFFER },
          SCOPE,
          { system: true },
        ),
      ).rejects.toMatchObject({ response: { error: 'OFFER_NOT_EXPIRED' } });
    });

    it('reads the deadline under the lock, not from the caller', async () => {
      inState(S.APPROVED, { offerExpiresAt: new Date(Date.now() - 1000) });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.CONFIRM_SEAT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'OFFER_EXPIRED' } });

      // The value came from the locked row: nothing in the request mentioned it.
      const lock = rawQuery.mock.calls.find((c) =>
        String(c[0]).includes('FOR UPDATE'),
      );
      expect(String(lock![0])).toContain('offerExpiresAt');
    });
  });

  describe('person resolution at submission', () => {
    it('resolves through the identity service and stores the result', async () => {
      inState(S.DRAFT, { personId: null });
      mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
        firstName: 'Riya',
        middleName: null,
        lastName: 'Sharma',
        dob: new Date('2015-04-12'),
        primaryMobile: '9876543210',
        programId: 'prog-1',
        personId: null,
      });

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.SUBMIT },
        SCOPE,
        ACTOR,
      );

      // Admissions does no matching of its own — a second implementation would
      // drift from the one that decides "same human".
      expect(resolvePerson).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ firstName: 'Riya', lastName: 'Sharma' }),
        expect.anything(),
      );
      expect(mockPrisma.applicant.update.mock.calls[0][0].data.personId).toBe(
        'person-1',
      );
    });

    it('does not resolve a second time for an applicant that already has one', async () => {
      inState(S.DRAFT);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.SUBMIT },
        SCOPE,
        ACTOR,
      );
      expect(resolvePerson).not.toHaveBeenCalled();
    });

    it('refuses to submit without a programme', async () => {
      inState(S.DRAFT, { programId: null });
      mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
        firstName: 'Riya',
        middleName: null,
        lastName: 'Sharma',
        dob: new Date('2015-04-12'),
        primaryMobile: '9876543210',
        programId: null,
        personId: null,
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.SUBMIT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'PROGRAM_REQUIRED' } });
    });

    it('does not block on identity candidates', async () => {
      inState(S.DRAFT, { personId: null });
      mockPrisma.applicant.findFirstOrThrow.mockResolvedValue({
        firstName: 'Aarav',
        middleName: null,
        lastName: 'Sharma',
        dob: new Date('2015-04-12'),
        primaryMobile: '9876543210',
        programId: 'prog-1',
        personId: null,
      });
      resolvePerson.mockResolvedValueOnce({
        personId: 'person-2',
        created: true,
        matchedByGovernmentId: false,
        warnings: [
          { personId: 'person-9', confidence: 'MEDIUM', matchedOn: ['phone+dob'] },
        ],
      });

      // Twins share a birthday, a household number and their parents. Refusing
      // on similarity refuses real applicants.
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.SUBMIT },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('history and events', () => {
    it('writes exactly one history row naming the action', async () => {
      inState(S.UNDER_REVIEW);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      expect(mockPrisma.workflowHistory.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workflowHistory.create.mock.calls[0][0].data).toMatchObject({
        entityType: 'APPLICANT',
        entityId: 'app-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        oldStatus: S.UNDER_REVIEW,
        newStatus: S.APPROVED,
        actionType: WorkflowAction.APPROVE,
      });
    });

    it('outboxes a distinctly named event per transition', async () => {
      inState(S.UNDER_REVIEW);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );
      expect(mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName).toBe(
        'applicant.offer_issued',
      );

      jest.clearAllMocks();
      inState(S.SUBMITTED);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.REJECT, remarks: 'incomplete' },
        SCOPE,
        ACTOR,
      );
      // A report can separate these two without reading field diffs, which a
      // generic `applicant.updated` would have forced.
      expect(mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName).toBe(
        'applicant.rejected',
      );
    });

    it('raises the audit severity of a force-reopen', async () => {
      inState(S.CANCELLED);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.FORCE_REOPEN, remarks: 'cancelled in error' },
        SCOPE,
        ACTOR,
      );
      expect(
        mockPrisma.outboxEvent.create.mock.calls[0][0].data.metadata,
      ).toMatchObject({ severity: 'WARN' });
    });

    it('carries no personal data in the event payload', async () => {
      inState(S.UNDER_REVIEW);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      const payload = mockPrisma.outboxEvent.create.mock.calls[0][0].data.payload;
      expect(Object.keys(payload).sort()).toEqual(
        ['action', 'applicantId', 'branchId', 'fromStatus', 'organizationId', 'toStatus'].sort(),
      );
    });
  });

  describe('actionsFrom', () => {
    it('hides system-only actions from the offered set', () => {
      const offered = actionsFrom(S.APPROVED);
      expect(offered).toContain(WorkflowAction.CONFIRM_SEAT);
      expect(offered).not.toContain(WorkflowAction.EXPIRE_OFFER);
    });

    it('offers nothing from a terminal state', () => {
      for (const state of TERMINAL_STATES) {
        expect(actionsFrom(state)).toHaveLength(0);
      }
    });
  });
});
