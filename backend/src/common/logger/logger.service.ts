import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

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
  errorMessage?: string | null;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: pino.Logger;
  private context: string = 'App';

  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';

    const stream = isDev
      ? pinoPretty({
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,context',
          messageFormat: (log: Record<string, unknown>, messageKey: string) => {
            const message = log[messageKey];
            const context = log.context;
            if (context) {
              return `[\x1b[33m${context as string}\x1b[0m] ${message as string}`;
            }
            return message as string;
          },
        })
      : undefined;

    this.logger = pino(
      {
        level: process.env.LOG_LEVEL || 'info',
      },
      stream as any,
    );
  }

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
