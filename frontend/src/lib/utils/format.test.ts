import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  getInitials,
  truncate,
  toTitleCase,
} from './format';

describe('formatDate', () => {
  it('formats ISO date string', () => {
    expect(formatDate('2024-04-01')).toBe('Apr 1, 2024');
  });

  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('accepts a custom format', () => {
    expect(formatDate('2024-04-01', 'yyyy/MM/dd')).toBe('2024/04/01');
  });
});

describe('formatNumber', () => {
  it('formats numbers with separators', () => {
    expect(formatNumber(4289)).toMatch(/4.289|4,289/); // locale-dependent
  });

  it('returns — for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('returns — for NaN', () => {
    expect(formatNumber(NaN)).toBe('—');
  });
});

describe('getInitials', () => {
  it('returns initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('returns ? for null', () => {
    expect(getInitials(null)).toBe('?');
  });

  it('uses first and last of multi-part name', () => {
    expect(getInitials('John Michael Doe')).toBe('JD');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    const result = truncate('This is a very long string', 20);
    expect(result).toBe('This is a very lo...');
    expect(result.length).toBe(20);
  });

  it('does not truncate short strings', () => {
    expect(truncate('Short', 50)).toBe('Short');
  });

  it('handles null', () => {
    expect(truncate(null)).toBe('');
  });
});

describe('toTitleCase', () => {
  it('converts SCREAMING_SNAKE_CASE', () => {
    expect(toTitleCase('BRANCH_ADMIN')).toBe('Branch Admin');
  });

  it('converts snake_case', () => {
    expect(toTitleCase('super_admin')).toBe('Super Admin');
  });

  it('handles null', () => {
    expect(toTitleCase(null)).toBe('');
  });
});

describe('formatPercent', () => {
  it('formats a decimal as percentage', () => {
    expect(formatPercent(0.245)).toBe('24.5%');
  });

  it('returns — for null', () => {
    expect(formatPercent(null)).toBe('—');
  });
});
