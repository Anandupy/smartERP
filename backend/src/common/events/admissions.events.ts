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

/**
 * Guardian events carry no PII — no name, no mobile number, no Aadhaar. An
 * event is copied into the outbox and the audit log, the widest distribution
 * a value can get; what travels is ids and booleans, the same rule
 * `person.events.ts` and `address.events.ts` document for their own
 * sensitive values. (Defect 6, §8.4 — the previous payload carried
 * firstName/lastName/mobilePrimary verbatim.)
 */
export class GuardianCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.created';
  readonly payload: {
    guardianId: string;
    organizationId: string;
    hasPersonLink: boolean;
  };

  constructor(
    payload: {
      guardianId: string;
      organizationId: string;
      hasPersonLink: boolean;
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

/** A Person was linked to a previously-unlinked Guardian profile. */
export class GuardianPersonLinkedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardian.person_linked';
  readonly payload: {
    guardianId: string;
    organizationId: string;
    personId: string;
  };

  constructor(
    payload: {
      guardianId: string;
      organizationId: string;
      personId: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianPersonLinkedEvent.EVENT_NAME,
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

/**
 * A persistent Person-to-Person `Guardianship` was created or its flags were
 * synced from the applicant-scoped mapping it derives from. There is no
 * `guardianship.updated`/`guardianship.ended`: nothing writes those paths yet
 * (see `GuardianshipService`), and an event for a write that cannot happen is
 * dead weight, not documentation.
 */
export class GuardianshipCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'guardianship.created';
  readonly payload: {
    guardianshipId: string;
    organizationId: string;
    guardianPersonId: string;
    wardPersonId: string;
    relationTypeId: string;
  };

  constructor(
    payload: {
      guardianshipId: string;
      organizationId: string;
      guardianPersonId: string;
      wardPersonId: string;
      relationTypeId: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: GuardianshipCreatedEvent.EVENT_NAME,
      aggregateId: payload.guardianshipId,
      aggregateType: 'Guardianship',
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

export class AdmissionsMasterCreatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'admissions_master.created';
  readonly payload: {
    masterType: string;
    id: string;
    code: string;
    name: string;
  };

  constructor(
    payload: {
      masterType: string;
      id: string;
      code: string;
      name: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AdmissionsMasterCreatedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: payload.masterType,
      metadata: { module: 'ADMISSIONS', ...metadata },
    });
    this.payload = payload;
  }
}

export class AdmissionsMasterUpdatedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'admissions_master.updated';
  readonly payload: {
    masterType: string;
    id: string;
    code?: string;
    name?: string;
  };

  constructor(
    payload: {
      masterType: string;
      id: string;
      code?: string;
      name?: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AdmissionsMasterUpdatedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: payload.masterType,
      metadata: { module: 'ADMISSIONS', ...metadata },
    });
    this.payload = payload;
  }
}

export class AdmissionsMasterDeletedEvent extends DomainEvent {
  static readonly EVENT_NAME = 'admissions_master.deleted';
  readonly payload: {
    masterType: string;
    id: string;
  };

  constructor(
    payload: {
      masterType: string;
      id: string;
    },
    metadata?: Record<string, any>,
  ) {
    super({
      eventName: AdmissionsMasterDeletedEvent.EVENT_NAME,
      aggregateId: payload.id,
      aggregateType: payload.masterType,
      metadata: { module: 'ADMISSIONS', ...metadata },
    });
    this.payload = payload;
  }
}
