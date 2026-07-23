import { DomainEvent } from './domain-event.base';

export class ApplicantCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'applicant.created';
  readonly payload: {
    applicantId: string;
    displayName: string;
    admissionFormNo: string;
    applicationNo: string;
    primaryMobile: string;
  };

  constructor(
    payload: {
      applicantId: string;
      displayName: string;
      admissionFormNo: string;
      applicationNo: string;
      primaryMobile: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ApplicantCreatedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class ApplicantUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'applicant.updated';
  readonly payload: {
    applicantId: string;
    displayName?: string;
  };

  constructor(
    payload: {
      applicantId: string;
      displayName?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ApplicantUpdatedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class ApplicantDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'applicant.deleted';
  readonly payload: {
    applicantId: string;
  };

  constructor(
    payload: {
      applicantId: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: ApplicantDeletedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class GuardianCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.created';
  readonly payload: {
    guardianId: string;
    firstName: string;
    lastName: string;
    mobilePrimary: string;
  };

  constructor(
    payload: {
      guardianId: string;
      firstName: string;
      lastName: string;
      mobilePrimary: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianCreatedEvent.EVENT_NAME,
      aggregateId: payload.guardianId,
      aggregateType: 'Guardian',
      metadata,
    });
    this.payload = payload;
  }
}

export class GuardianUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.updated';
  readonly payload: {
    guardianId: string;
  };

  constructor(
    payload: {
      guardianId: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianUpdatedEvent.EVENT_NAME,
      aggregateId: payload.guardianId,
      aggregateType: 'Guardian',
      metadata,
    });
    this.payload = payload;
  }
}

export class GuardianMappedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.mapped';
  readonly payload: {
    applicantId: string;
    guardianId: string;
    relationTypeId: string;
    isPrimary: boolean;
  };

  constructor(
    payload: {
      applicantId: string;
      guardianId: string;
      relationTypeId: string;
      isPrimary: boolean;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianMappedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class GuardianUnmappedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.unmapped';
  readonly payload: {
    applicantId: string;
    guardianId: string;
  };

  constructor(
    payload: {
      applicantId: string;
      guardianId: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianUnmappedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class AdmissionWorkflowTransitionedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'admission.transitioned';
  readonly payload: {
    applicantId: string;
    oldStatus: string;
    newStatus: string;
    actionType: string;
  };

  constructor(
    payload: {
      applicantId: string;
      oldStatus: string;
      newStatus: string;
      actionType: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AdmissionWorkflowTransitionedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class EnrollmentCompletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'enrollment.completed';
  readonly payload: {
    applicantId: string;
    programId: string;
    academicUnitId: string;
    rollNumber?: string;
  };

  constructor(
    payload: {
      applicantId: string;
      programId: string;
      academicUnitId: string;
      rollNumber?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: EnrollmentCompletedEvent.EVENT_NAME,
      aggregateId: payload.applicantId,
      aggregateType: 'Applicant',
      metadata,
    });
    this.payload = payload;
  }
}

export class NumberingConfigCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'numbering_config.created';
  readonly payload: {
    configId: string;
    purpose: string;
    format: string;
  };

  constructor(
    payload: {
      configId: string;
      purpose: string;
      format: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: NumberingConfigCreatedEvent.EVENT_NAME,
      aggregateId: payload.configId,
      aggregateType: 'NumberSequenceConfig',
      metadata,
    });
    this.payload = payload;
  }
}
