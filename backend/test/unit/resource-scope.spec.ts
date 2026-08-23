import { ForbiddenException } from '@nestjs/common';
import {
  assertOrganizationInScope,
  assertBranchInScope,
} from '@/common/scope/resource-scope';
import { UserRole } from '@/common/enums/role.enum';
import { buildRequestContext } from '../factories/request-context.factory';

describe('assertOrganizationInScope', () => {
  it('lets SUPER_ADMIN target any organization', () => {
    const context = buildRequestContext({
      role: UserRole.SUPER_ADMIN,
      organizationId: 'org-1',
    });

    expect(() => assertOrganizationInScope(context, 'org-other')).not.toThrow();
  });

  it('lets a scoped role target its own organization', () => {
    const context = buildRequestContext({
      role: UserRole.ORG_ADMIN,
      organizationId: 'org-1',
    });

    expect(() => assertOrganizationInScope(context, 'org-1')).not.toThrow();
  });

  it('rejects a scoped role targeting a different organization', () => {
    const context = buildRequestContext({
      role: UserRole.ORG_ADMIN,
      organizationId: 'org-1',
    });

    expect(() => assertOrganizationInScope(context, 'org-2')).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the context has no resolved organization', () => {
    const context = buildRequestContext({
      role: UserRole.ORG_ADMIN,
      organizationId: null,
    });

    expect(() => assertOrganizationInScope(context, 'org-1')).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a missing target organization id', () => {
    const context = buildRequestContext({
      role: UserRole.ORG_ADMIN,
      organizationId: 'org-1',
    });

    expect(() => assertOrganizationInScope(context, null)).toThrow(
      ForbiddenException,
    );
  });

  it('treats an absent context as a trusted internal caller', () => {
    expect(() => assertOrganizationInScope(undefined, 'org-1')).not.toThrow();
  });
});

describe('assertBranchInScope', () => {
  it('lets SUPER_ADMIN target any branch', () => {
    const context = buildRequestContext({
      role: UserRole.SUPER_ADMIN,
      branchId: 'branch-1',
    });

    expect(() => assertBranchInScope(context, 'branch-other')).not.toThrow();
  });

  it('lets ORG_ADMIN target a branch outside their currently selected one', () => {
    const context = buildRequestContext({
      role: UserRole.ORG_ADMIN,
      organizationId: 'org-1',
      branchId: 'branch-1',
    });

    // ORG_ADMIN is org-scoped, not branch-scoped — pair with
    // assertOrganizationInScope for the tenant boundary.
    expect(() => assertBranchInScope(context, 'branch-2')).not.toThrow();
  });

  it('lets BRANCH_ADMIN target their own branch', () => {
    const context = buildRequestContext({
      role: UserRole.BRANCH_ADMIN,
      branchId: 'branch-1',
    });

    expect(() => assertBranchInScope(context, 'branch-1')).not.toThrow();
  });

  it('rejects BRANCH_ADMIN targeting a different branch', () => {
    const context = buildRequestContext({
      role: UserRole.BRANCH_ADMIN,
      branchId: 'branch-1',
    });

    expect(() => assertBranchInScope(context, 'branch-2')).toThrow(
      ForbiddenException,
    );
  });

  it('treats an absent context as a trusted internal caller', () => {
    expect(() => assertBranchInScope(undefined, 'branch-1')).not.toThrow();
  });
});
