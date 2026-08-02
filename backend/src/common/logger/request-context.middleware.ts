import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { RequestContextService } from './request-context.service';
import type {
  AuthenticatedRequest,
  MutableRequestContext,
} from './request-context.types';

export * from './request-context.types';

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
      // `req.ip` reflects X-Forwarded-For only when TRUST_PROXY is enabled;
      // see docs/core/public-endpoint-protection.md.
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: (req.headers['user-agent'] as string) || null,
      httpMethod: req.method,
      route: req.originalUrl || req.url,
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
