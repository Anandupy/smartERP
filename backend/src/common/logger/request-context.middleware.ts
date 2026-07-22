import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { RequestContextService } from './request-context.service';

export interface RequestContext {
  requestId: string;
  branchId: string | null;
  branch?: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    institutionType: string;
    isActive: boolean;
    isDeleted: boolean;
  } | null;
  academicYearId: string | null;
  academicYear?: {
    id: string;
    branchId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    isSelected: boolean;
    isLocked: boolean;
  } | null;
  organizationId: string | null;
  userId: string | null;
  role: string | null;
}

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
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv7();

    const branchId = (req.headers['x-branch-id'] as string) || null;
    const academicYearId =
      (req.headers['x-academic-year-id'] as string) || null;

    req.requestId = requestId;
    req.context = {
      requestId,
      branchId,
      academicYearId,
      organizationId: null,
      userId: null,
      role: null,
    };

    // Add to response header
    res.setHeader('x-request-id', requestId);

    RequestContextService.run(req.context, () => {
      next();
    });
  }
}
