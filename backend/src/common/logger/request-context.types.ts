import { Request } from 'express';

/**
 * Shape of the per-request execution context.
 *
 * Kept apart from the middleware so that `RequestContextService` can depend on
 * these types without closing a require cycle: the middleware imports the
 * service to open the AsyncLocalStorage scope.
 *
 * The middleware re-exports everything here, so existing imports from
 * `request-context.middleware` continue to work.
 */

export interface RequestContextBranch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  institutionType: string;
  isActive: boolean;
  isDeleted: boolean;
}

export interface RequestContextAcademicYear {
  id: string;
  branchId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isSelected: boolean;
  isLocked: boolean;
}

/**
 * The identity and tenant scope of a request.
 *
 * These are the only fields that change after the request context is created,
 * and `ExecutionContextGuard` is the only component allowed to change them —
 * see `docs/core/execution-context.md`.
 */
export interface ExecutionScope {
  userId: string | null;
  /** Recorded on every audit row so an actor stays identifiable after deletion. */
  userEmail: string | null;
  role: string | null;
  organizationId: string | null;
  branchId: string | null;
  academicYearId: string | null;
  branch: RequestContextBranch | null;
  academicYear: RequestContextAcademicYear | null;
}

/**
 * Envelope fields fixed at request creation. They never change.
 */
export interface RequestEnvelope {
  requestId: string;
  clientApp: string;
  clientVersion: string;
  platform: string;
  /**
   * Transport facts. The audit log records these for every entry; without them
   * a security investigation cannot place an action on a network or a device.
   */
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string;
  route: string;
}

/**
 * Reserved scope dimensions. Declared so consumers can read them today and the
 * resolver can populate them later without another interface change.
 */
export interface ReservedScope {
  programId: string | null;
  departmentId: string | null;
  campusId: string | null;
}

/**
 * Internal, writable view of the request context.
 *
 * Only `RequestContextMiddleware` (which creates it) and
 * `RequestContextService.applyExecutionScope` (the single mutation point) use
 * this type. Everything else consumes the read-only `RequestContext`.
 */
export interface MutableRequestContext
  extends RequestEnvelope, ExecutionScope, ReservedScope {}

/**
 * The request context as every consumer sees it: read-only.
 *
 * `readonly` here is a compile-time contract, not a runtime freeze. It exists
 * so that a guard, interceptor or service attempting to mutate the context
 * fails to build rather than silently competing with the context owner.
 */
export type RequestContext = Readonly<MutableRequestContext>;

export interface AuthenticatedUser {
  id?: string;
  sub?: string;
  email?: string;
  role?: string;
  organizationId?: string;
  branchId?: string;
}

export interface AuthenticatedRequest extends Request {
  context: RequestContext;
  requestId: string;
  user?: AuthenticatedUser;
  /**
   * Convenience mirror of `context.userId` for controllers that pass an actor
   * id straight into a service. Written by `ExecutionContextGuard` only.
   */
  userId?: string | null;
}
