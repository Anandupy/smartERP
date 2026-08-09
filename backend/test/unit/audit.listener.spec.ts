import { Test, TestingModule } from '@nestjs/testing';
import { AuditListener } from '@/infrastructure/audit/audit.listener';
import { AuditRepository } from '@/infrastructure/audit/audit.repository';
import { AuditEventMapper } from '@/infrastructure/audit/audit-event.mapper';
import { EventBus } from '@/infrastructure/events/event-bus.interface';
import { EventsModule } from '@/infrastructure/events/events.module';
import { StudentCreatedEvent } from '@/common/events/student.events';
import { BranchCreatedEvent } from '@/common/events/examples/branch-created.event';
import { UserLoggedInEvent } from '@/common/events/examples/user-logged-in.event';

describe('AuditListener', () => {
  let listener: AuditListener;
  let eventBus: EventBus;
  let auditRepository: AuditRepository;

  const mockAuditRepository = {
    createAuditLog: jest.fn().mockResolvedValue({ id: 'audit-log-123' }),
    findAuditLogs: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EventsModule],
      providers: [
        AuditListener,
        AuditEventMapper,
        { provide: AuditRepository, useValue: mockAuditRepository },
      ],
    }).compile();

    listener = moduleRef.get<AuditListener>(AuditListener);
    eventBus = moduleRef.get<EventBus>(EventBus);
    auditRepository = moduleRef.get<AuditRepository>(AuditRepository);

    listener.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should automatically subscribe to registered domain events and persist audit logs when published', async () => {
    const event = new StudentCreatedEvent({
        studentId: 'stud-999',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      });

    await eventBus.publish(event);

    expect(mockAuditRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'student.created',
        action: 'CREATE',
        module: 'ADMISSIONS',
        aggregateId: 'stud-999',
      }),
    );
  });

  it('should persist audit log for BranchCreatedEvent', async () => {
    const event = new BranchCreatedEvent({
      branchId: 'br-500',
      name: 'West Branch',
      code: 'WB-01',
    });

    await eventBus.publish(event);

    expect(mockAuditRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'branch.created',
        action: 'CREATE',
        module: 'ORGANIZATION',
        aggregateId: 'br-500',
      }),
    );
  });

  it('should support dynamic event subscription at runtime', async () => {
    const customEventName = 'custom.payment.received';
    listener.listenToEvent(customEventName);

    const customEvent = new StudentCreatedEvent({
        studentId: 'stud-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      });
    Object.defineProperty(customEvent, 'eventName', { value: customEventName });

    await eventBus.publish(customEvent);

    expect(mockAuditRepository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: customEventName,
      }),
    );
  });

  it('should handle high-concurrency event publishing and persist all audit entries', async () => {
    const tasks: Promise<void>[] = [];

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
    }

    await Promise.all(tasks);

    expect(mockAuditRepository.createAuditLog).toHaveBeenCalledTimes(20);
  });

  it('should isolate repository errors without crashing event execution', async () => {
    mockAuditRepository.createAuditLog.mockRejectedValueOnce(
      new Error('Failed write to audit DB'),
    );

    const event = new UserLoggedInEvent({
      userId: 'u-1',
      username: 'test_admin',
      loginAt: new Date(),
    });

    await expect(eventBus.publish(event)).resolves.not.toThrow();
  });
});
