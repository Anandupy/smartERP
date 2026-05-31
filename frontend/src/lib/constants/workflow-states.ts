// ============================================================
// Workflow State Constants — Admissions state machine
// ============================================================

export type WorkflowState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'DOCUMENT_PENDING'
  | 'FEE_PENDING'
  | 'WAITLISTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/**
 * Valid state transitions for the admissions workflow.
 * Terminal states have empty arrays.
 */
export const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: [
    'APPROVED',
    'DOCUMENT_PENDING',
    'FEE_PENDING',
    'WAITLISTED',
    'REJECTED',
    'CANCELLED',
  ],
  DOCUMENT_PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  FEE_PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  WAITLISTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const TERMINAL_STATES: WorkflowState[] = ['APPROVED', 'REJECTED', 'CANCELLED'];

export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  DOCUMENT_PENDING: 'Documents Pending',
  FEE_PENDING: 'Fee Pending',
  WAITLISTED: 'Waitlisted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/**
 * Check if a workflow transition is valid.
 */
export function canTransition(
  from: WorkflowState,
  to: WorkflowState,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a state is terminal (no further transitions possible).
 */
export function isTerminalState(state: WorkflowState): boolean {
  return TERMINAL_STATES.includes(state);
}
