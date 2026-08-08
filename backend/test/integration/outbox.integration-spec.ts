import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AppModule } from '@/app.module';
import { OutboxPublisher } from '@/infrastructure/outbox/outbox.publisher';
import { OutboxRelay } from '@/infrastructure/outbox/outbox.relay';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { AuditListener } from '@/infrastructure/audit/audit.listener';
import { DomainEvent } from '@/common/events/domain-event.base';
import { RequestContextService } from '@/common/logger/request-context.service';
import type { MutableRequestContext } from '@/common/logger/request-context.types';

class ProbeEvent extends DomainEvent {
  static readonly EVENT_NAME = 'applicant.updated';
  readonly payload: { applicantId: string; displayName: string };

  constructor(payload: { applicantId: string; displayName: string }) {
    super({
      eventName: ProbeEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
    });
    this.payload = payload;
  }
}

function contextFor(overrides: Partial<MutableRequestContext> = {}) {
  return {
    requestId: 'req-outbox-test',
    clientApp: 'test',
    clientVersion: '1.0.0',
    platform: 'WEB',
    ipAddress: '10.0.0.1',
    userAgent: 'jest',
    httpMethod: 'POST',
    route: '/v1/test',
    userId: 'user-outbox-test',
    userEmail: 'actor@test.local',
    role: 'ORG_ADMIN',
    organizationId: 'org-outbox-test',
    branchId: 'branch-outbox-test',
    academicYearId: 'year-outbox-test',
    branch: null,
    academicYear: null,
    programId: null,
    departmentId: null,
    campusId: null,
    ...overrides,
  } as MutableRequestContext;
}

describe('Transactional outbox (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let outbox: OutboxPublisher;
  let relay: OutboxRelay;
  let eventBus: EventBus;

  const aggregateIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    outbox = moduleRef.get(OutboxPublisher);
    relay = moduleRef.get(OutboxRelay);
    eventBus = moduleRef.get(EventBus);

    // The listener registers on module init; make sure it is live so the
    // deduplication assertions exercise the real audit path.
    moduleRef.get(AuditListener);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { aggregateId: { in: aggregateIds } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: aggregateIds } },
    });
    await moduleRef.close();
  });

  function newAggregateId(): string {
    const id = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    aggregateIds.push(id);
    return id;
  }

  it('commits the event with the data it describes', async () => {
    const aggregateId = newAggregateId();

    await prisma.$transaction(async (tx) => {
      await outbox.enqueue(
        new ProbeEvent({ applicantId: aggregateId, displayName: 'Committed' }),
        tx,
      );
    });

    const row = await prisma.outboxEvent.findFirst({ where: { aggregateId } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('PENDING');
  });

  it('discards the event when the transaction rolls back', async () => {
    const aggregateId = newAggregateId();

    await prisma
      .$transaction(async (tx) => {
        await outbox.enqueue(
          new ProbeEvent({ applicantId: aggregateId, displayName: 'Rolled back' }),
          tx,
        );
        throw new Error('rollback');
      })
      .catch(() => undefined);

    // An event describing data that was never written must not be published.
    const row = await prisma.outboxEvent.findFirst({ where: { aggregateId } });
    expect(row).toBeNull();
  });

  /**
   * The failure the outbox exists to prevent: the transaction commits, the
   * process dies before the in-process bus delivers anything, and the event is
   * gone forever. Simulated by committing and never calling the relay — the row
   * is still there, and a later drain publishes it.
   */
  it('survives a crash between commit and publish', async () => {
    const aggregateId = newAggregateId();
    const received: string[] = [];
    const handler = (event: DomainEvent) => {
      if (event.aggregateId === aggregateId) received.push(event.eventId);
    };
    eventBus.subscribe(ProbeEvent.EVENT_NAME, handler);

    try {
      await prisma.$transaction(async (tx) => {
        await outbox.enqueue(
          new ProbeEvent({ applicantId: aggregateId, displayName: 'Survivor' }),
          tx,
        );
      });

      // Nothing has been published yet — this is the crash window.
      expect(received).toHaveLength(0);

      await relay.drain();

      expect(received).toHaveLength(1);
      const row = await prisma.outboxEvent.findFirst({ where: { aggregateId } });
      expect(row!.status).toBe('PUBLISHED');
      expect(row!.publishedAt).not.toBeNull();
    } finally {
      eventBus.unsubscribe(ProbeEvent.EVENT_NAME, handler);
    }
  });

  it('restores the actor so a replayed event is not attributed to nobody', async () => {
    const aggregateId = newAggregateId();

    await RequestContextService.run(contextFor(), async () => {
      await prisma.$transaction(async (tx) => {
        await outbox.enqueue(
          new ProbeEvent({ applicantId: aggregateId, displayName: 'Attributed' }),
          tx,
        );
      });
    });

    // The relay runs on a timer, outside any request: AsyncLocalStorage is
    // empty here, exactly as it would be in production.
    expect(RequestContextService.getStore()).toBeUndefined();

    await relay.drain();

    const audit = await prisma.auditLog.findFirst({ where: { aggregateId } });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe('user-outbox-test');
    expect(audit!.userEmail).toBe('actor@test.local');
    expect(audit!.organizationId).toBe('org-outbox-test');
    expect(audit!.requestId).toBe('req-outbox-test');
  });

  it('writes one audit row when the same event is delivered twice', async () => {
    const aggregateId = newAggregateId();

    const event = new ProbeEvent({
      applicantId: aggregateId,
      displayName: 'Duplicated',
    });

    await RequestContextService.run(contextFor(), async () => {
      await eventBus.publish(event);
      await eventBus.publish(event);
    });

    const rows = await prisma.auditLog.findMany({ where: { aggregateId } });
    // At-least-once delivery makes a second arrival normal, not exceptional.
    // AuditLog.eventId is unique, so the replay is a no-op.
    expect(rows).toHaveLength(1);
    expect(rows[0].eventId).toBe(event.eventId);
  });

  it('records the event id on every audit row it writes', async () => {
    const aggregateId = newAggregateId();
    const event = new ProbeEvent({
      applicantId: aggregateId,
      displayName: 'Identified',
    });

    await RequestContextService.run(contextFor(), async () => {
      await eventBus.publish(event);
    });

    const row = await prisma.auditLog.findFirst({ where: { aggregateId } });
    expect(row!.eventId).toBe(event.eventId);
  });

  it('refuses two outbox rows for one event id', async () => {
    const aggregateId = newAggregateId();
    const event = new ProbeEvent({
      applicantId: aggregateId,
      displayName: 'Once only',
    });

    await prisma.$transaction(async (tx) => {
      await outbox.enqueue(event, tx);
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await outbox.enqueue(event, tx);
      }),
    ).rejects.toThrow();
  });
});
