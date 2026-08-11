import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { EventEmitterEventBus } from '@/infrastructure/events/adapters/event-emitter.event-bus';
import { EventsModule } from '@/infrastructure/events/events.module';
import { StudentCreatedEvent } from '@/common/events/student.events';
import { BranchCreatedEvent } from '@/common/events/examples/branch-created.event';
import { UserLoggedInEvent } from '@/common/events/examples/user-logged-in.event';

describe('EventBus Infrastructure', () => {
  let eventBus: EventBus;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EventsModule],
    }).compile();

    eventBus = moduleRef.get<EventBus>(EventBus);
  });

  it('should resolve EventBus instance from NestJS DI container', () => {
    expect(eventBus).toBeDefined();
    expect(eventBus).toBeInstanceOf(EventEmitterEventBus);
  });

  it('should publish a single event and invoke registered subscribers', async () => {
    const receivedEvents: StudentCreatedEvent[] = [];

    const handler = (event: StudentCreatedEvent) => {
      receivedEvents.push(event);
    };

    eventBus.subscribe(StudentCreatedEvent.EVENT_NAME, handler);

    const event = new StudentCreatedEvent({
      studentId: 'stud-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });

    await eventBus.publish(event);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].payload.studentCode).toBe('STU0000000001');

    eventBus.unsubscribe(StudentCreatedEvent.EVENT_NAME, handler);
  });

  it('should publish batch events using publishAll', async () => {
    const received: string[] = [];

    const handler = (event: StudentCreatedEvent) => {
      received.push(event.payload.studentId);
    };

    eventBus.subscribe(StudentCreatedEvent.EVENT_NAME, handler);

    const events = [
      new StudentCreatedEvent({
        studentId: 's1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      }),
      new StudentCreatedEvent({
        studentId: 's2',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      }),
      new StudentCreatedEvent({
        studentId: 's3',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      }),
    ];

    await eventBus.publishAll(events);

    expect(received).toEqual(['s1', 's2', 's3']);

    eventBus.unsubscribe(StudentCreatedEvent.EVENT_NAME, handler);
  });

  it('should notify multiple subscribers for the same event type', async () => {
    let subscriber1Count = 0;
    let subscriber2Count = 0;

    const sub1 = () => {
      subscriber1Count++;
    };
    const sub2 = () => {
      subscriber2Count++;
    };

    eventBus.subscribe('test.multiple', sub1);
    eventBus.subscribe('test.multiple', sub2);

    const event = new BranchCreatedEvent({
      branchId: 'b1',
      name: 'Branch 1',
      code: 'B1',
    });
    Object.defineProperty(event, 'eventName', { value: 'test.multiple' });

    await eventBus.publish(event);

    expect(subscriber1Count).toBe(1);
    expect(subscriber2Count).toBe(1);

    eventBus.unsubscribe('test.multiple', sub1);
    eventBus.unsubscribe('test.multiple', sub2);
  });

  it('should isolate subscriber errors so a failing handler does not disrupt other subscribers or crash the bus', async () => {
    let sub2Executed = false;

    const failingSub = () => {
      throw new Error('Subscriber runtime crash failure');
    };
    const healthySub = () => {
      sub2Executed = true;
    };

    eventBus.subscribe('test.error.isolation', failingSub);
    eventBus.subscribe('test.error.isolation', healthySub);

    const event = new StudentCreatedEvent({
      studentId: 's1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });
    Object.defineProperty(event, 'eventName', {
      value: 'test.error.isolation',
    });

    await expect(eventBus.publish(event)).resolves.not.toThrow();
    expect(sub2Executed).toBe(true);

    eventBus.unsubscribe('test.error.isolation', failingSub);
    eventBus.unsubscribe('test.error.isolation', healthySub);
  });

  it('should handle high-concurrency event publishing without race conditions, duplicates, or dropped events', async () => {
    const studentEventsReceived: StudentCreatedEvent[] = [];
    const branchEventsReceived: BranchCreatedEvent[] = [];
    const userEventsReceived: UserLoggedInEvent[] = [];

    eventBus.subscribe<StudentCreatedEvent>(
      StudentCreatedEvent.EVENT_NAME,
      (e) => {
        studentEventsReceived.push(e);
      },
    );
    eventBus.subscribe<BranchCreatedEvent>(
      BranchCreatedEvent.EVENT_NAME,
      (e) => {
        branchEventsReceived.push(e);
      },
    );
    eventBus.subscribe<UserLoggedInEvent>(UserLoggedInEvent.EVENT_NAME, (e) => {
      userEventsReceived.push(e);
    });

    const tasks: Promise<void>[] = [];

    // Publish 20 StudentCreated, 20 BranchCreated, 20 UserLoggedIn concurrently
    for (let i = 1; i <= 20; i++) {
      tasks.push(
        eventBus.publish(
          new StudentCreatedEvent({
            studentId: `s-${i}`,
            organizationId: 'org-1',
            branchId: 'branch-1',
            personId: `person-${i}`,
            studentCode: `STU${String(i).padStart(10, '0')}`,
            createdVia: 'ADMISSION',
            sourceApplicantId: `app-${i}`,
          }),
        ),
      );
      tasks.push(
        eventBus.publish(
          new BranchCreatedEvent({
            branchId: `b-${i}`,
            name: `Branch ${i}`,
            code: `BR-${i}`,
          }),
        ),
      );
      tasks.push(
        eventBus.publish(
          new UserLoggedInEvent({
            userId: `u-${i}`,
            username: `user_${i}`,
            loginAt: new Date(),
          }),
        ),
      );
    }

    await Promise.all(tasks);

    expect(studentEventsReceived).toHaveLength(20);
    expect(branchEventsReceived).toHaveLength(20);
    expect(userEventsReceived).toHaveLength(20);

    // Verify all IDs are unique (no duplicates)
    const studentIds = new Set(
      studentEventsReceived.map((e) => e.payload.studentId),
    );
    expect(studentIds.size).toBe(20);
  });

  it('should correctly unsubscribe handlers and clean up listeners', async () => {
    let callCount = 0;
    const handler = () => {
      callCount++;
    };

    eventBus.subscribe('test.cleanup', handler);

    const event = new StudentCreatedEvent({
      studentId: 's1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      personId: 'person-1',
      studentCode: 'STU0000000001',
      createdVia: 'ADMISSION',
      sourceApplicantId: 'app-1',
    });
    Object.defineProperty(event, 'eventName', { value: 'test.cleanup' });

    await eventBus.publish(event);
    expect(callCount).toBe(1);

    eventBus.unsubscribe('test.cleanup', handler);

    await eventBus.publish(event);
    expect(callCount).toBe(1); // Should remain 1 after unsubscribe
  });
});
