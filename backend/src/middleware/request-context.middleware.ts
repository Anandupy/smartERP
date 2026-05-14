import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  requestId: string;
  branchId: string | null;
  academicYearId: string | null;
  organizationId: string | null;
  userId: string | null;
  role: string | null;
}

export interface AuthenticatedRequest extends Request {
  context: RequestContext;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const branchId = (req.headers['x-branch-id'] as string) || null;
    const academicYearId =
      (req.headers['x-academic-year-id'] as string) || null;

    req.context = {
      requestId,
      branchId,
      academicYearId,
      organizationId: null,
      userId: null,
      role: null,
    };

    next();
  }
}
