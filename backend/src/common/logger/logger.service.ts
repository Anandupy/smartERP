import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import pino from 'pino';
import { getRootLogger } from './pino-root-logger';

export interface LogPayload {
  [key: string]: any;
  context?: string;
}

export interface RequestLogData {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  requestId: string;
  ip?: string;
  userId?: string | null;
  role?: string | null;
  organizationId?: string | null;
  branchId?: string | null;
  academicYearId?: string | null;
  errorMessage?: string | null;
  [key: string]: any;
}

/**
 * Per-consumer logging facade.
 *
 * Transient so that each injecting class can label its output via
 * `setContext`. The pino instance and its file streams are process-wide — see
 * `pino-root-logger.ts` for why that separation matters.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly logger: pino.Logger = getRootLogger();
  private context: string = 'App';

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    const ctx = context || this.context;

    // Filter out noisy NestJS internal logs
    if (
      ctx === 'RouterExplorer' ||
      ctx === 'InstanceLoader' ||
      ctx === 'RoutesResolver'
    ) {
      return;
    }

    this.logger.info({ context: ctx }, message);
  }

  error(message: any, trace?: string, context?: string) {
    const ctx = context || this.context;
    this.logger.error({ context: ctx, trace }, message);
  }

  warn(message: any, context?: string) {
    const ctx = context || this.context;
    this.logger.warn({ context: ctx }, message);
  }

  debug(message: any, context?: string) {
    const ctx = context || this.context;
    this.logger.debug({ context: ctx }, message);
  }

  verbose(message: any, context?: string) {
    const ctx = context || this.context;
    this.logger.trace({ context: ctx }, message);
  }

  // Custom method for structured request logging
  logRequest(data: RequestLogData) {
    const { method, url, statusCode, responseTime, requestId, ...rest } = data;

    const isSlow = responseTime > 1000;
    const logLevel = isSlow ? 'warn' : 'info';

    const slowPrefix = isSlow ? '🐢 [SLOW] ' : '[REQ] ';
    const message = `${slowPrefix}${method} ${url}`;

    const logPayload = {
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      ...rest,
      context: 'HTTP',
    };

    this.logger[logLevel](logPayload, message);
  }
}
