import {
  MutableRequestContext,
  RequestContext,
} from '@/common/logger/request-context.middleware';

/**
 * Builds a complete RequestContext for tests.
 *
 * The context is created whole by RequestContextMiddleware in production, so
 * tests should never hand-roll partial literals — that is how a fixture ends up
 * asserting against a shape the application can never produce.
 */
export const buildRequestContext = (
  overrides: Partial<MutableRequestContext> = {},
): RequestContext => ({
  requestId: 'req-test-1',
  clientApp: 'campusflow-web',
  clientVersion: '1.0.0',
  platform: 'WEB',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  httpMethod: 'GET',
  route: '/test',
  userId: null,
  userEmail: null,
  role: null,
  organizationId: null,
  branchId: null,
  academicYearId: null,
  branch: null,
  academicYear: null,
  programId: null,
  departmentId: null,
  campusId: null,
  ...overrides,
});
