import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAtLeast,
  getDefaultRedirect,
} from './permissions';

describe('hasPermission', () => {
  it('SUPER_ADMIN has org:create', () => {
    expect(hasPermission('SUPER_ADMIN', 'org:create')).toBe(true);
  });

  it('ORG_ADMIN does not have org:create', () => {
    expect(hasPermission('ORG_ADMIN', 'org:create')).toBe(false);
  });

  it('SUPER_ADMIN has all system permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'system:init')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'system:maintenance')).toBe(true);
  });

  it('STAFF does not have admin permissions', () => {
    expect(hasPermission('STAFF', 'org:create')).toBe(false);
    expect(hasPermission('STAFF', 'branch:create')).toBe(false);
    expect(hasPermission('STAFF', 'theme:update')).toBe(false);
  });

  it('STAFF can create admissions', () => {
    expect(hasPermission('STAFF', 'admissions:create')).toBe(true);
  });
});

describe('isAtLeast', () => {
  it('SUPER_ADMIN is at least SUPER_ADMIN', () => {
    expect(isAtLeast('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });

  it('SUPER_ADMIN is at least ORG_ADMIN', () => {
    expect(isAtLeast('SUPER_ADMIN', 'ORG_ADMIN')).toBe(true);
  });

  it('STAFF is not at least BRANCH_ADMIN', () => {
    expect(isAtLeast('STAFF', 'BRANCH_ADMIN')).toBe(false);
  });

  it('BRANCH_ADMIN is at least STAFF', () => {
    expect(isAtLeast('BRANCH_ADMIN', 'STAFF')).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  it('returns true when all permissions are granted', () => {
    expect(hasAllPermissions('SUPER_ADMIN', ['org:create', 'org:delete'])).toBe(true);
  });

  it('returns false when any permission is missing', () => {
    expect(hasAllPermissions('ORG_ADMIN', ['org:create', 'branch:create'])).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true when at least one permission is granted', () => {
    expect(hasAnyPermission('ORG_ADMIN', ['org:create', 'branch:create'])).toBe(true);
  });

  it('returns false when no permissions are granted', () => {
    expect(hasAnyPermission('STAFF', ['org:create', 'system:init'])).toBe(false);
  });
});

describe('getDefaultRedirect', () => {
  it('redirects SUPER_ADMIN to organizations', () => {
    expect(getDefaultRedirect('SUPER_ADMIN')).toBe('/administration/organizations');
  });

  it('redirects STAFF to admissions', () => {
    expect(getDefaultRedirect('STAFF')).toBe('/admissions');
  });

  it('redirects ORG_ADMIN to dashboard', () => {
    expect(getDefaultRedirect('ORG_ADMIN')).toBe('/dashboard');
  });
});
