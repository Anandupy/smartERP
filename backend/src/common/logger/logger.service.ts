import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import * as fs from 'fs';
import * as path from 'path';

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
    const logsDir = path.join(process.cwd(), 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const streams: pino.StreamEntry[] = [];

    // Common pretty options for Dev (both console and file)
    const prettyOptions = {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname', // Hide internal noise
      messageFormat: (log: Record<string, unknown>, messageKey: string) => {
        const message = log[messageKey];
        const context = log.context;
        if (context) {
          return `[\x1b[33m${context as string}\x1b[0m] ${message as string}`;
        }
        return message as string;
      },
    };

    // Console Stream
    if (isDev) {
      streams.push({
        level: 'info',
        stream: pinoPretty(prettyOptions),
      });
    } else {
      streams.push({ level: 'info', stream: process.stdout });
    }

    // File Streams - Use pretty printing in dev for readability, JSON in prod
    const fileStream = isDev
      ? pinoPretty({
          ...prettyOptions,
          colorize: false, // No colors in files
        })
      : undefined;

    streams.push({
      level: 'info',
      stream:
        fileStream ||
        fs.createWriteStream(path.join(logsDir, 'app.log'), {
          flags: 'a',
        }),
    });

    if (fileStream) {
      // In dev, we also want the pretty output saved to app.log
      (fileStream as any).pipe(
        fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' }),
      );
    }

    // Error-specific file stream
    streams.push({
      level: 'error',
      stream: fs.createWriteStream(path.join(logsDir, 'error.log'), {
        flags: 'a',
      }),
    });

    this.logger = pino(
      {
        level: process.env.LOG_LEVEL || 'info',
        base: undefined, // Remove pid and hostname from the base object
      },
      pino.multistream(streams),
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
