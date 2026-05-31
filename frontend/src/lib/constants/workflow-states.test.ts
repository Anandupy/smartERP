import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminalState,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
} from './workflow-states';

describe('canTransition', () => {
  it('DRAFT → SUBMITTED is valid', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
  });

  it('DRAFT → APPROVED is invalid', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
  });

  it('APPROVED → anything is invalid (terminal)', () => {
    expect(canTransition('APPROVED', 'SUBMITTED')).toBe(false);
    expect(canTransition('APPROVED', 'UNDER_REVIEW')).toBe(false);
  });

  it('UNDER_REVIEW → APPROVED is valid', () => {
    expect(canTransition('UNDER_REVIEW', 'APPROVED')).toBe(true);
  });

  it('UNDER_REVIEW → REJECTED is valid', () => {
    expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
  });
});

describe('isTerminalState', () => {
  it('APPROVED is terminal', () => {
    expect(isTerminalState('APPROVED')).toBe(true);
  });

  it('REJECTED is terminal', () => {
    expect(isTerminalState('REJECTED')).toBe(true);
  });

  it('CANCELLED is terminal', () => {
    expect(isTerminalState('CANCELLED')).toBe(true);
  });

  it('DRAFT is not terminal', () => {
    expect(isTerminalState('DRAFT')).toBe(false);
  });

  it('UNDER_REVIEW is not terminal', () => {
    expect(isTerminalState('UNDER_REVIEW')).toBe(false);
  });
});

describe('TERMINAL_STATES have empty transitions', () => {
  it.each(TERMINAL_STATES)('%s has no valid transitions', (state) => {
    expect(VALID_TRANSITIONS[state]).toHaveLength(0);
  });
});
