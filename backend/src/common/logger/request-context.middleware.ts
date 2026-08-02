import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { RequestContextService } from './request-context.service';

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

const SUPPORTED_PLATFORMS = ['WEB', 'MOBILE', 'DESKTOP'];

/**
 * Creates the per-request context and opens the AsyncLocalStorage scope that
 * carries it.
 *
 * The middleware records only what the transport itself provides — a request
 * id and client metadata. Identity and tenant scope are left null; resolving
 * them requires the authenticated user, which does not exist until the guard
 * pipeline runs.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv7();

    const rawPlatform = (req.headers['x-platform'] as string) || 'WEB';
    const normalizedPlatform = rawPlatform.toUpperCase();
    const platform = SUPPORTED_PLATFORMS.includes(normalizedPlatform)
      ? normalizedPlatform
      : 'WEB';

    const clientApp =
      (req.headers['x-client-app'] as string) || 'campusflow-web';
    const clientVersion =
      (req.headers['x-client-version'] as string) || '1.0.0';

    const context: MutableRequestContext = {
      requestId,
      clientApp,
      clientVersion,
      platform,
      userId: null,
      role: null,
      organizationId: null,
      branchId: null,
      academicYearId: null,
      branch: null,
      academicYear: null,
      programId: null,
      departmentId: null,
      campusId: null,
    };

    req.requestId = requestId;
    req.context = context;

    // Add to response header
    res.setHeader('x-request-id', requestId);

    RequestContextService.run(context, () => {
      next();
    });
  }
}
