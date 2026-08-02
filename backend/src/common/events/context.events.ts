import { DomainEvent } from './domain-event.base';

export interface ContextValidationFailedPayload {
  userId?: string | null;
  role?: string | null;
  reason: string;
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
  requestId?: string | null;
}

export class ContextValidationFailedEvent extends DomainEvent {
  readonly payload: ContextValidationFailedPayload;

  constructor(payload: ContextValidationFailedPayload) {
    super({
      eventName: 'context.validation_failed',
      aggregateId: payload.userId || 'system',
      aggregateType: 'CONTEXT',
      metadata: {
        severity: 'WARN',
        status: 'FAILURE',
        action: 'VALIDATE_CONTEXT',
      },
    });
    this.payload = payload;
  }
}

export interface ContextAccessDeniedPayload {
  userId: string;
  role: string;
  targetOrganizationId?: string | null;
  targetBranchId?: string | null;
  targetAcademicYearId?: string | null;
  reason: string;
  requestId?: string | null;
}

export class ContextAccessDeniedEvent extends DomainEvent {
  readonly payload: ContextAccessDeniedPayload;

  constructor(payload: ContextAccessDeniedPayload) {
    super({
      eventName: 'context.access_denied',
      aggregateId: payload.userId,
      aggregateType: 'CONTEXT',
      metadata: {
        severity: 'WARN',
        status: 'FAILURE',
        action: 'ACCESS_CONTEXT',
      },
    });
    this.payload = payload;
  }
}

export interface ContextSelectionRequiredPayload {
  userId: string;
  role: string;
  availableOrganizationsCount: number;
  availableBranchesCount: number;
  availableAcademicYearsCount: number;
  requestId?: string | null;
}

export class ContextSelectionRequiredEvent extends DomainEvent {
  readonly payload: ContextSelectionRequiredPayload;

  constructor(payload: ContextSelectionRequiredPayload) {
    super({
      eventName: 'context.selection_required',
      aggregateId: payload.userId,
      aggregateType: 'CONTEXT',
      metadata: {
        severity: 'INFO',
        status: 'SUCCESS',
        action: 'SELECT_CONTEXT',
      },
    });
    this.payload = payload;
  }
}
