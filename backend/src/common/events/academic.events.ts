import { DomainEvent } from './domain-event.base';

// --- Academic Year Events ---
export class AcademicYearCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_year.created';
  readonly payload: { academicYearId: string; name: string; branchId: string };

  constructor(
    payload: { academicYearId: string; name: string; branchId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicYearCreatedEvent.EVENT_NAME,
      aggregateId: payload.academicYearId,
      aggregateType: 'AcademicYear',
      metadata,
    });
    this.payload = payload;
  }
}

export class AcademicYearUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_year.updated';
  readonly payload: { academicYearId: string; name?: string };

  constructor(
    payload: { academicYearId: string; name?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicYearUpdatedEvent.EVENT_NAME,
      aggregateId: payload.academicYearId,
      aggregateType: 'AcademicYear',
      metadata,
    });
    this.payload = payload;
  }
}

export class AcademicYearDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_year.deleted';
  readonly payload: { academicYearId: string };

  constructor(
    payload: { academicYearId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicYearDeletedEvent.EVENT_NAME,
      aggregateId: payload.academicYearId,
      aggregateType: 'AcademicYear',
      metadata,
    });
    this.payload = payload;
  }
}

// --- Academic Unit Events ---
export class AcademicUnitCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_unit.created';
  readonly payload: { academicUnitId: string; name: string; branchId: string; programId: string; academicYearId: string };

  constructor(
    payload: { academicUnitId: string; name: string; branchId: string; programId: string; academicYearId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicUnitCreatedEvent.EVENT_NAME,
      aggregateId: payload.academicUnitId,
      aggregateType: 'AcademicUnit',
      metadata,
    });
    this.payload = payload;
  }
}

export class AcademicUnitUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_unit.updated';
  readonly payload: { academicUnitId: string; name?: string };

  constructor(
    payload: { academicUnitId: string; name?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicUnitUpdatedEvent.EVENT_NAME,
      aggregateId: payload.academicUnitId,
      aggregateType: 'AcademicUnit',
      metadata,
    });
    this.payload = payload;
  }
}

export class AcademicUnitDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'academic_unit.deleted';
  readonly payload: { academicUnitId: string };

  constructor(
    payload: { academicUnitId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AcademicUnitDeletedEvent.EVENT_NAME,
      aggregateId: payload.academicUnitId,
      aggregateType: 'AcademicUnit',
      metadata,
    });
    this.payload = payload;
  }
}

// --- Program Events ---
export class ProgramCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'program.created';
  readonly payload: { programId: string; name: string; branchId: string };

  constructor(
    payload: { programId: string; name: string; branchId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ProgramCreatedEvent.EVENT_NAME,
      aggregateId: payload.programId,
      aggregateType: 'Program',
      metadata,
    });
    this.payload = payload;
  }
}

export class ProgramUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'program.updated';
  readonly payload: { programId: string; name?: string };

  constructor(
    payload: { programId: string; name?: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ProgramUpdatedEvent.EVENT_NAME,
      aggregateId: payload.programId,
      aggregateType: 'Program',
      metadata,
    });
    this.payload = payload;
  }
}

export class ProgramDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'program.deleted';
  readonly payload: { programId: string };

  constructor(
    payload: { programId: string },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ProgramDeletedEvent.EVENT_NAME,
      aggregateId: payload.programId,
      aggregateType: 'Program',
      metadata,
    });
    this.payload = payload;
  }
}
