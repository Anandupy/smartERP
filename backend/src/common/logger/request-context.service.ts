import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContext } from './request-context.middleware';

@Injectable()
export class RequestContextService {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run callback within a RequestContext scope
   */
  static run<T>(context: RequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current RequestContext from the active async execution thread
   */
  static getStore(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Instance method for NestJS Dependency Injection
   */
  getContext(): RequestContext | undefined {
    return RequestContextService.getStore();
  }
}
