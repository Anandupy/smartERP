import { DomainEvent } from '../domain-event.base';

export interface StudentCreatedPayload {
  studentId: string;
  fullName: string;
  admissionNo: string;
}

export class StudentCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'student.created';
  readonly payload: StudentCreatedPayload;

  constructor(payload: StudentCreatedPayload, metadata?: Record<string, any>) {
    super({
      eventName: StudentCreatedEvent.EVENT_NAME,
      aggregateId: payload.studentId,
      aggregateType: 'Student',
      metadata,
    });
    this.payload = payload;
  }
}
