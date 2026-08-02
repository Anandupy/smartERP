import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import {
  ExecutionScope,
  MutableRequestContext,
  RequestContext,
} from './request-context.middleware';

@Injectable()
export class RequestContextService {
  private static readonly asyncLocalStorage =
    new AsyncLocalStorage<MutableRequestContext>();

  /**
   * Run callback within a RequestContext scope
   */
  static run<T>(context: MutableRequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current RequestContext from the active async execution thread
   */
  static getStore(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * The single mutation point for the request context.
   *
   * `ExecutionContextGuard` is the only caller. The AsyncLocalStorage store and
   * `req.context` are the same object, so writing here updates both views at
   * once and no consumer can observe them diverging.
   *
   * Every scope field is assigned on each call, so the context after resolution
   * never mixes values from two different resolution attempts.
   */
  static applyExecutionScope(
    context: RequestContext,
    scope: ExecutionScope,
  ): void {
    const writable = context as MutableRequestContext;

    writable.userId = scope.userId;
    writable.userEmail = scope.userEmail;
    writable.role = scope.role;
    writable.organizationId = scope.organizationId;
    writable.branchId = scope.branchId;
    writable.academicYearId = scope.academicYearId;
    writable.branch = scope.branch;
    writable.academicYear = scope.academicYear;
  }

  /**
   * Instance method for NestJS Dependency Injection
   */
  getContext(): RequestContext | undefined {
    return RequestContextService.getStore();
  }
}
