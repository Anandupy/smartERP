import { DomainEvent } from '@/common/events/domain-event.base';
import { StudentCreatedEvent } from '@/common/events/student.events';
import { BranchCreatedEvent } from '@/common/events/examples/branch-created.event';
import { UserLoggedInEvent } from '@/common/events/examples/user-logged-in.event';

class TestDomainEvent extends DomainEvent {
  constructor(aggregateId: string, metadata?: Record<string, any>) {
    super({
      eventName: 'test.event',
      aggregateId,
      aggregateType: 'TestAggregate',
      metadata,
    });
  }
}

describe('DomainEvent Foundation', () => {
  it('should auto-generate a valid UUID v7 eventId and occurredAt timestamp', () => {
    const event = new TestDomainEvent('agg-123');

    expect(event.eventId).toBeDefined();
    expect(typeof event.eventId).toBe('string');
    // Verify standard UUID format
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.aggregateId).toBe('agg-123');
    expect(event.aggregateType).toBe('TestAggregate');
    expect(event.version).toBe(1);
  });

  it('should preserve custom parameters if explicitly provided', () => {
    const customId = '018f6f4c-1234-789a-bcde-f0123456789a';
    const customDate = new Date('2026-01-01T00:00:00Z');

    class CustomEvent extends DomainEvent {
      constructor() {
        super({
          eventName: 'custom.event',
          aggregateId: 'agg-custom',
          aggregateType: 'Custom',
          version: 3,
          metadata: { ip: '127.0.0.1' },
          eventId: customId,
          occurredAt: customDate,
        });
      }
    }

    const event = new CustomEvent();

    expect(event.eventId).toBe(customId);
    expect(event.occurredAt).toEqual(customDate);
    expect(event.version).toBe(3);
    expect(event.metadata).toEqual({ ip: '127.0.0.1' });
  });

  it('should not contain context fields (userId, requestId, branchId, orgId) in base event attributes', () => {
    const event = new StudentCreatedEvent({
        studentId: 'stud-101',
        organizationId: 'org-1',
        branchId: 'branch-1',
        personId: 'person-1',
        studentCode: 'STU0000000001',
        createdVia: 'ADMISSION',
        sourceApplicantId: 'app-1',
      });

    const keys = Object.keys(event);

    expect(keys).not.toContain('userId');
    expect(keys).not.toContain('requestId');
    expect(keys).not.toContain('branchId');
    expect(keys).not.toContain('organizationId');
    expect(event.eventName).toBe('student.created');
    expect(event.aggregateType).toBe('Student');
    expect(event.payload.studentId).toBe('stud-101');
  });

  it('should correctly instantiate example domain events', () => {
    const branchEvent = new BranchCreatedEvent({
      branchId: 'branch-1',
      name: 'North Campus',
      code: 'NC-01',
    });

    expect(branchEvent.eventName).toBe('branch.created');
    expect(branchEvent.aggregateId).toBe('branch-1');
    expect(branchEvent.payload.code).toBe('NC-01');

    const userEvent = new UserLoggedInEvent({
      userId: 'user-99',
      username: 'admin_user',
      loginAt: new Date(),
    });

    expect(userEvent.eventName).toBe('user.logged_in');
    expect(userEvent.aggregateId).toBe('user-99');
  });
});
