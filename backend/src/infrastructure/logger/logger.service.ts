import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

      winston.format.printf((info: any) => {
        const { timestamp, level, message, context, trace } = info;
        const ts =
          typeof timestamp === 'string' ? timestamp : new Date().toISOString();
        const lvl = typeof level === 'string' ? level : 'info';
        const ctx = typeof context === 'string' ? context : 'App';
        const msg =
          typeof message === 'object'
            ? JSON.stringify(message)
            : String(message);
        const tr = trace
          ? `\n${typeof trace === 'object' ? JSON.stringify(trace, null, 2) : String(trace)}`
          : '';

        return `[${ts}] ${lvl} [${ctx}]: ${msg}${tr}`;
      }),
    );

    this.logger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context });
  }

  logRequest(data: {
    requestId: string;
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    userId: string | null;
    branchId: string | null;
  }) {
    this.logger.info(
      `[HTTP] ${data.method} ${data.url} ${data.statusCode} - ${data.responseTime}ms`,
      {
        context: 'HTTP',
        ...data,
      },
    );
  }
}
