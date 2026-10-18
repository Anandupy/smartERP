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
import { ChecklistService } from '@/modules/documents/checklist.service';
import { ConfigurationService } from '@/modules/configuration/configuration.service';
import {
  ADMISSION_CONFIG_KEYS,
  CONFIG_DEFINITIONS,
} from '@/modules/configuration/config.registry';
import {
  actionsFrom,
  DIRECT_ADMISSION_PLAN,
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
  const isChecklistSatisfied = jest
    .fn()
    .mockResolvedValue({ satisfied: true, missing: [] });

  /** Configuration values in force, by key; anything absent is the default. */
  let policyOverrides: Record<string, unknown> = {};
  const resolveMany = jest.fn(
    async (keys: readonly string[], _scope: unknown, asOf: Date) =>
      new Map(
        keys.map((key) => {
          const spec = CONFIG_DEFINITIONS.find((d) => d.key === key)!;
          const set = key in policyOverrides;
          return [
            key,
            {
              key,
              value: set ? policyOverrides[key] : spec.defaultValue,
              source: set ? 'BRANCH' : 'DEFAULT',
              version: set ? 1 : null,
              effectiveFrom: set ? asOf : null,
            },
          ];
        }),
      ),
  );

  const mockPrisma: any = {
    applicant: {
      update: jest.fn().mockResolvedValue({ id: 'app-1' }),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowHistory: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
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
        {
          provide: ChecklistService,
          useValue: { isSatisfied: isChecklistSatisfied },
        },
        { provide: ConfigurationService, useValue: { resolveMany } },
      ],
    }).compile();

    workflow = module.get(WorkflowService);
    config = module.get(AdmissionConfigProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    rawQuery.lockResult = [];
    hasPermission.mockResolvedValue(true);
    policyOverrides = {};
    mockPrisma.workflowHistory.findFirst.mockResolvedValue(null);
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
      // candidate is not quietly reversible; ADMITTED because a student, an
      // admission and an enrolment now exist behind it. DEFERRED is terminal
      // for *this*
      // application by design — deferring to the next cycle produces a new
      // Applicant carrying `deferredFromApplicantId`, not a reopening of this
      // one, so the original stays as evidence of what was decided when.
      expect(statesWithNoExit().sort()).toEqual(
        [S.DEFERRED, S.ADMITTED, S.REJECTED, S.WITHDRAWN].sort(),
      );

      // The declared terminal set is the subset that is terminal permanently.
      expect(TERMINAL_STATES).not.toContain(S.DEFERRED);
    });

    it('lets nothing but the orchestrator produce ADMITTED', () => {
      const intoAdmitted = TRANSITIONS.filter((t) => t.to === S.ADMITTED);

      // Exactly one edge, and it is unreachable through the generic endpoint.
      // ADMITTED means a Student, an Admission and an Enrolment exist; a
      // status-only route into it would produce the outcome without any of
      // them, which is what `orchestratedOnly` prevents.
      expect(intoAdmitted).toHaveLength(1);
      expect(intoAdmitted[0]).toMatchObject({
        action: WorkflowAction.ADMIT,
        from: [S.SEAT_CONFIRMED],
        orchestratedOnly: true,
      });
      expect(findRule(WorkflowAction.ADMIT)).toBeDefined();
    });

    it('marks only the admit edge as orchestrated', () => {
      expect(
        TRANSITIONS.filter((t) => t.orchestratedOnly).map((t) => t.action),
      ).toEqual([WorkflowAction.ADMIT]);
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

      expect(
        mockPrisma.applicant.update.mock.calls[0][0].data.admissionStatus,
      ).toBe(to);
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

      policyOverrides[ADMISSION_CONFIG_KEYS.allowDeferment] = true;
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
        workflow.transition(
          'app-1',
          { action, remarks: 'attempt' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'INVALID_TRANSITION' } });

      // Refused before anything is written.
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
      expect(mockPrisma.workflowHistory.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('refuses a bare request to admit', async () => {
      inState(S.SEAT_CONFIRMED);

      // The state is right and the actor is permitted; what is missing is the
      // rest of the transaction. Nothing a client can put in a request body
      // sets `orchestrated`, so this is the only answer the endpoint can give.
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.ADMIT },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({
        response: { error: 'ORCHESTRATED_TRANSITION' },
      });

      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
    });

    it('admits when the orchestrator asks, from SEAT_CONFIRMED only', async () => {
      inState(S.SEAT_CONFIRMED);

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.ADMIT, orchestrated: true },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
      expect(
        mockPrisma.applicant.update.mock.calls[0][0].data.admissionStatus,
      ).toBe(S.ADMITTED);

      jest.clearAllMocks();
      hasPermission.mockResolvedValue(true);
      inState(S.APPROVED);

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.ADMIT, orchestrated: true },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'INVALID_TRANSITION' } });
    });

    it('joins a caller transaction instead of opening its own', async () => {
      inState(S.SEAT_CONFIRMED);
      const tx: any = {
        applicant: { update: jest.fn().mockResolvedValue({ id: 'app-1' }) },
        workflowHistory: { create: jest.fn().mockResolvedValue({}) },
        outboxEvent: { create: jest.fn().mockResolvedValue({}) },
        $queryRawUnsafe: rawQuery,
      };

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.ADMIT, orchestrated: true },
        SCOPE,
        ACTOR,
        tx,
      );

      // A second transaction here would put the status change outside the one
      // that wrote the student, so a later failure would leave an applicant
      // marked admitted with nothing behind them.
      expect(tx.applicant.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
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
        workflow.transition('app-1', { action: WorkflowAction.SUBMIT }, SCOPE, {
          userId: null,
          role: null,
        }),
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
      expect(
        mockPrisma.workflowHistory.create.mock.calls[0][0].data.actionBy,
      ).toBe('SYSTEM');
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
      expect(
        mockPrisma.workflowHistory.create.mock.calls[0][0].data.remarks,
      ).toBe('incomplete documents');
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
      policyOverrides[ADMISSION_CONFIG_KEYS.offerValidityDays] = 7;
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
  });

  describe('the document checklist guard (R5)', () => {
    it('refuses to approve when the checklist reports missing documents', async () => {
      inState(S.UNDER_REVIEW);
      isChecklistSatisfied.mockResolvedValueOnce({
        satisfied: false,
        missing: [
          {
            documentTypeId: 'dt-1',
            code: 'BIRTH_CERTIFICATE',
            name: 'Birth Certificate',
          },
        ],
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'DOCUMENTS_INCOMPLETE' } });
    });

    it("passes the applicant's programId/quotaId/categoryId and both stages to the checklist", async () => {
      inState(S.UNDER_REVIEW, { quotaId: 'quota-1', categoryId: 'cat-1' });

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      expect(isChecklistSatisfied).toHaveBeenCalledWith(
        expect.objectContaining({
          applicantId: 'app-1',
          branchId: SCOPE.branchId,
          personId: 'person-1',
          programId: 'prog-1',
          quotaId: 'quota-1',
          categoryId: 'cat-1',
        }),
        [S.UNDER_REVIEW, S.APPROVED],
        SCOPE.organizationId,
        expect.anything(),
      );
    });

    it('allows the transition once the checklist is satisfied', async () => {
      inState(S.UNDER_REVIEW);
      isChecklistSatisfied.mockResolvedValueOnce({
        satisfied: true,
        missing: [],
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('seat confirmation and the offer window', () => {
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
          {
            personId: 'person-9',
            confidence: 'MEDIUM',
            matchedOn: ['phone+dob'],
          },
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
      expect(
        mockPrisma.workflowHistory.create.mock.calls[0][0].data,
      ).toMatchObject({
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
      expect(
        mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName,
      ).toBe('applicant.offer_issued');

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
      expect(
        mockPrisma.outboxEvent.create.mock.calls[0][0].data.eventName,
      ).toBe('applicant.rejected');
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

      const payload =
        mockPrisma.outboxEvent.create.mock.calls[0][0].data.payload;
      expect(Object.keys(payload).sort()).toEqual(
        [
          'action',
          'applicantId',
          'branchId',
          'fromStatus',
          'organizationId',
          'toStatus',
        ].sort(),
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

  // ---------------------------------------------------------------------------
  // Configurable admission workflows
  // ---------------------------------------------------------------------------

  describe('the graph is not configurable', () => {
    it('keeps exactly the edges it had before workflow profiles existed', () => {
      const edges = TRANSITIONS.map(
        (t) => `${t.action}:${[...t.from].sort().join('|')}>${t.to}`,
      ).sort();
      expect(edges).toEqual(
        [
          'submit:DRAFT>SUBMITTED',
          'startReview:SUBMITTED>UNDER_REVIEW',
          'requestDocuments:UNDER_REVIEW>DOCUMENT_PENDING',
          'documentsReceived:DOCUMENT_PENDING>UNDER_REVIEW',
          'requestFee:UNDER_REVIEW>FEE_PENDING',
          'waitlist:UNDER_REVIEW>WAITLISTED',
          'approve:DOCUMENT_PENDING|FEE_PENDING|UNDER_REVIEW|WAITLISTED>APPROVED',
          'confirmSeat:APPROVED>SEAT_CONFIRMED',
          'defer:APPROVED>DEFERRED',
          'expireOffer:APPROVED>CANCELLED',
          'reject:DOCUMENT_PENDING|FEE_PENDING|SUBMITTED|UNDER_REVIEW|WAITLISTED>REJECTED',
          'withdraw:APPROVED|DOCUMENT_PENDING|DRAFT|FEE_PENDING|SEAT_CONFIRMED|SUBMITTED|UNDER_REVIEW|WAITLISTED>WITHDRAWN',
          'cancel:APPROVED|DOCUMENT_PENDING|DRAFT|FEE_PENDING|SEAT_CONFIRMED|SUBMITTED|UNDER_REVIEW|WAITLISTED>CANCELLED',
          'admit:SEAT_CONFIRMED>ADMITTED',
          'forceReopen:CANCELLED>UNDER_REVIEW',
        ].sort(),
      );
    });

    it('reaches ADMITTED by one orchestrated rule only', () => {
      const intoAdmitted = TRANSITIONS.filter((t) => t.to === S.ADMITTED);
      expect(intoAdmitted).toHaveLength(1);
      expect(intoAdmitted[0].action).toBe(WorkflowAction.ADMIT);
      expect(intoAdmitted[0].orchestratedOnly).toBe(true);
    });

    it('the direct-admission plan walks only legal edges and ends at SEAT_CONFIRMED', () => {
      for (const [start, plan] of Object.entries(DIRECT_ADMISSION_PLAN)) {
        let state = start as S;
        for (const action of plan!) {
          const rule = findRule(action)!;
          expect(rule.from).toContain(state);
          expect(rule.orchestratedOnly).toBeFalsy();
          expect(rule.systemOnly).toBeFalsy();
          state = rule.to;
        }
        expect(state).toBe(S.SEAT_CONFIRMED);
      }
    });

    it('cannot directly admit from a terminal or deferred state', () => {
      for (const state of [
        S.ADMITTED,
        S.REJECTED,
        S.WITHDRAWN,
        S.CANCELLED,
        S.DEFERRED,
      ]) {
        expect(DIRECT_ADMISSION_PLAN[state]).toBeUndefined();
      }
    });
  });

  describe('policy resolution', () => {
    it('defaults to STANDARD_ADMISSION with every optional step available', async () => {
      const policy = await workflow.policyFor(SCOPE, null);
      expect(policy).toMatchObject({
        workflowProfile: 'STANDARD_ADMISSION',
        offerValidityDays: 15,
        allowDeferment: false,
        waitlistEnabled: true,
        feeStepEnabled: true,
        documentRequestEnabled: true,
      });
      expect(policy.sources.workflowProfile).toBe('DEFAULT');
    });

    it('resolves an in-flight application as of its submission, not now', async () => {
      const submittedAt = new Date('2026-06-01T10:00:00Z');
      inState(S.UNDER_REVIEW, { submittedAt });

      await workflow.transition(
        'app-1',
        { action: WorkflowAction.APPROVE },
        SCOPE,
        ACTOR,
      );

      expect(resolveMany).toHaveBeenCalledWith(
        expect.any(Array),
        { organizationId: 'org-1', branchId: 'branch-1' },
        submittedAt,
      );
    });

    it('resolves a draft as of now', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue({
        id: 'app-1',
        admissionStatus: S.DRAFT,
        personId: null,
        programId: 'prog-1',
        quotaId: null,
        categoryId: null,
        offerExpiresAt: null,
        academicYearId: 'year-1',
        submittedAt: null,
      });
      const before = Date.now();

      const result = await workflow.describeActions('app-1', SCOPE, ACTOR);

      const asOf = resolveMany.mock.calls.at(-1)![2];
      expect(asOf.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.policyAsOf.getTime()).toBe(asOf.getTime());
    });
  });

  describe('policy switches are enforced by the engine', () => {
    it.each([
      [
        WorkflowAction.WAITLIST,
        ADMISSION_CONFIG_KEYS.waitlistEnabled,
        'on the list',
      ],
      [
        WorkflowAction.REQUEST_FEE,
        ADMISSION_CONFIG_KEYS.feeStepEnabled,
        undefined,
      ],
      [
        WorkflowAction.REQUEST_DOCUMENTS,
        ADMISSION_CONFIG_KEYS.documentRequestEnabled,
        'need TC',
      ],
    ])(
      'refuses %s with POLICY_DISABLED when switched off',
      async (action, key, remarks) => {
        policyOverrides[key] = false;
        inState(S.UNDER_REVIEW);

        await expect(
          workflow.transition('app-1', { action, remarks }, SCOPE, ACTOR),
        ).rejects.toMatchObject({
          response: { error: 'POLICY_DISABLED', policy: key },
        });
        expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
        expect(mockPrisma.workflowHistory.create).not.toHaveBeenCalled();
      },
    );

    it.each([
      [WorkflowAction.WAITLIST, 'on the list'],
      [WorkflowAction.REQUEST_FEE, undefined],
      [WorkflowAction.REQUEST_DOCUMENTS, 'need TC'],
    ])('allows %s by default, as before', async (action, remarks) => {
      inState(S.UNDER_REVIEW);
      await expect(
        workflow.transition('app-1', { action, remarks }, SCOPE, ACTOR),
      ).resolves.toBeDefined();
    });

    it('still enforces the permission on an enabled step', async () => {
      hasPermission.mockResolvedValue(false);
      inState(S.UNDER_REVIEW);
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.WAITLIST, remarks: 'x' },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('document stage enforcement (D2)', () => {
    it.each([
      [S.DRAFT, WorkflowAction.SUBMIT, [S.DRAFT, S.SUBMITTED]],
      [S.APPROVED, WorkflowAction.CONFIRM_SEAT, [S.APPROVED, S.SEAT_CONFIRMED]],
    ])(
      'checks the checklist when leaving %s via %s',
      async (state, action, stages) => {
        inState(state);
        isChecklistSatisfied.mockResolvedValueOnce({
          satisfied: false,
          missing: [{ documentTypeId: 'dt-1', code: 'TC', name: 'TC' }],
        });

        await expect(
          workflow.transition('app-1', { action }, SCOPE, ACTOR),
        ).rejects.toMatchObject({
          response: { error: 'DOCUMENTS_INCOMPLETE' },
        });
        expect(isChecklistSatisfied).toHaveBeenCalledWith(
          expect.objectContaining({ branchId: SCOPE.branchId }),
          stages,
          SCOPE.organizationId,
          expect.anything(),
        );
        expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
      },
    );

    it('checks SEAT_CONFIRMED and ADMITTED requirements inside admit', async () => {
      inState(S.SEAT_CONFIRMED);
      isChecklistSatisfied.mockResolvedValueOnce({
        satisfied: false,
        missing: [],
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.ADMIT, orchestrated: true },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'DOCUMENTS_INCOMPLETE' } });
      expect(isChecklistSatisfied).toHaveBeenCalledWith(
        expect.anything(),
        [S.SEAT_CONFIRMED, S.ADMITTED],
        SCOPE.organizationId,
        expect.anything(),
      );
    });
  });

  describe('VERIFIED_ADMISSION', () => {
    beforeEach(() => {
      policyOverrides[ADMISSION_CONFIG_KEYS.workflowProfile] =
        'VERIFIED_ADMISSION';
    });

    it('requires SUBMITTED and UNDER_REVIEW documents before review starts', async () => {
      inState(S.SUBMITTED);
      isChecklistSatisfied.mockResolvedValueOnce({
        satisfied: false,
        missing: [],
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.START_REVIEW },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({ response: { error: 'DOCUMENTS_INCOMPLETE' } });
      expect(isChecklistSatisfied).toHaveBeenCalledWith(
        expect.anything(),
        [S.SUBMITTED, S.UNDER_REVIEW],
        SCOPE.organizationId,
        expect.anything(),
      );
    });

    it('refuses an approval by the user who started the review, read from history', async () => {
      inState(S.UNDER_REVIEW);
      mockPrisma.workflowHistory.findFirst.mockResolvedValue({
        actionBy: ACTOR.userId,
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).rejects.toMatchObject({
        response: { error: 'MAKER_CHECKER_VIOLATION' },
      });
      expect(mockPrisma.workflowHistory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityId: 'app-1',
            actionType: {
              in: [WorkflowAction.START_REVIEW, WorkflowAction.FORCE_REOPEN],
            },
          }),
          orderBy: { timestamp: 'desc' },
        }),
      );
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
    });

    it('allows a different approver', async () => {
      inState(S.UNDER_REVIEW);
      mockPrisma.workflowHistory.findFirst.mockResolvedValue({
        actionBy: 'reviewer-2',
      });

      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('STANDARD_ADMISSION keeps its previous behaviour', () => {
    it('does not check documents at startReview', async () => {
      inState(S.SUBMITTED);
      await workflow.transition(
        'app-1',
        { action: WorkflowAction.START_REVIEW },
        SCOPE,
        ACTOR,
      );
      expect(isChecklistSatisfied).not.toHaveBeenCalled();
    });

    it('lets the reviewer approve', async () => {
      inState(S.UNDER_REVIEW);
      mockPrisma.workflowHistory.findFirst.mockResolvedValue({
        actionBy: ACTOR.userId,
      });
      await expect(
        workflow.transition(
          'app-1',
          { action: WorkflowAction.APPROVE },
          SCOPE,
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('orchestration marker', () => {
    it('records a direct-admission step on its event and, without remarks, in history', async () => {
      inState(S.SUBMITTED);
      await workflow.transition(
        'app-1',
        {
          action: WorkflowAction.START_REVIEW,
          orchestration: 'DIRECT_ADMISSION',
        },
        SCOPE,
        ACTOR,
      );

      expect(
        mockPrisma.outboxEvent.create.mock.calls[0][0].data.payload,
      ).toMatchObject({
        orchestration: 'DIRECT_ADMISSION',
      });
      expect(
        mockPrisma.workflowHistory.create.mock.calls[0][0].data.remarks,
      ).toBe('Recorded as part of a direct admission.');
    });
  });

  describe('describeActions', () => {
    const applicantRow = (status: S, extra: Record<string, unknown> = {}) => ({
      id: 'app-1',
      admissionStatus: status,
      personId: 'person-1',
      programId: 'prog-1',
      quotaId: null,
      categoryId: null,
      offerExpiresAt: null,
      academicYearId: 'year-1',
      submittedAt: new Date(),
      ...extra,
    });

    it('lists the legal actions with permission and blockers, never a system action', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(
        applicantRow(S.APPROVED, {
          offerExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      const result = await workflow.describeActions('app-1', SCOPE, ACTOR);

      expect(result.actions.map((a) => a.action)).not.toContain(
        WorkflowAction.EXPIRE_OFFER,
      );
      const confirm = result.actions.find(
        (a) => a.action === WorkflowAction.CONFIRM_SEAT,
      )!;
      expect(confirm.available).toBe(false);
      expect(confirm.blockedBy.map((b) => b.code)).toContain('OFFER_EXPIRED');
      const defer = result.actions.find(
        (a) => a.action === WorkflowAction.DEFER,
      )!;
      expect(defer.blockedBy.map((b) => b.code)).toContain(
        'DEFERMENT_DISABLED',
      );
    });

    it('explains missing documents with the documents', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(
        applicantRow(S.UNDER_REVIEW),
      );
      const missing = [
        { documentTypeId: 'dt-1', code: 'TC', name: 'Transfer certificate' },
      ];
      isChecklistSatisfied.mockResolvedValue({ satisfied: false, missing });

      const result = await workflow.describeActions('app-1', SCOPE, ACTOR);
      const approve = result.actions.find(
        (a) => a.action === WorkflowAction.APPROVE,
      )!;

      expect(approve.blockedBy).toEqual([
        expect.objectContaining({ code: 'DOCUMENTS_INCOMPLETE', missing }),
      ]);
      isChecklistSatisfied.mockResolvedValue({ satisfied: true, missing: [] });
    });

    it('marks an action the caller lacks permission for as not available', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(
        applicantRow(S.UNDER_REVIEW),
      );
      hasPermission.mockImplementation(
        async (_u: string, _r: string, p: string) => p !== 'admissions.approve',
      );

      const result = await workflow.describeActions('app-1', SCOPE, ACTOR);
      const approve = result.actions.find(
        (a) => a.action === WorkflowAction.APPROVE,
      )!;

      expect(approve).toMatchObject({ permitted: false, available: false });
      expect(result.directAdmission.permitted).toBe(false);
    });

    it('offers direct admission only under SIMPLE_ADMISSION', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(
        applicantRow(S.DRAFT, { submittedAt: null }),
      );

      expect(
        (await workflow.describeActions('app-1', SCOPE, ACTOR)).directAdmission,
      ).toMatchObject({
        offered: false,
        available: false,
      });

      policyOverrides[ADMISSION_CONFIG_KEYS.workflowProfile] =
        'SIMPLE_ADMISSION';
      const simple = await workflow.describeActions('app-1', SCOPE, ACTOR);
      expect(simple.profile).toBe('SIMPLE_ADMISSION');
      expect(simple.directAdmission).toMatchObject({
        offered: true,
        fromCurrentState: true,
        permitted: true,
        available: true,
      });
    });

    it("is scoped: another branch's applicant is not found", async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(null);
      await expect(
        workflow.describeActions('app-1', OTHER_BRANCH, ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.applicant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 'branch-2',
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('writes nothing', async () => {
      mockPrisma.applicant.findFirst.mockResolvedValue(
        applicantRow(S.UNDER_REVIEW),
      );
      await workflow.describeActions('app-1', SCOPE, ACTOR);
      expect(mockPrisma.applicant.update).not.toHaveBeenCalled();
      expect(mockPrisma.workflowHistory.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });
  });
});
