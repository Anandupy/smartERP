import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@/generated/client';
import { LoggerService } from '@/common/logger/logger.service';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import { PrismaErrorTranslator } from './prisma-error-translator';
import { MaintenanceException } from '@/common/filters/maintenance.exception';
import { ResponseEnvelope } from '@/common/http/response-envelope';

/** Envelope keys that must not be duplicated into `error.details`. */
const ENVELOPE_KEYS = new Set(['message', 'statusCode', 'error']);

/** A deliberate machine-readable code, as opposed to Nest's reason phrases. */
const MACHINE_CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Renders every failure in the shared response envelope.
 *
 * @see docs/core/response-contract.md
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();

    const requestId = request.requestId || 'unknown';
    const url = request.url;
    const method = request.method;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please contact administrator.';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: Record<string, unknown> | null = null;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const translated = PrismaErrorTranslator.translate(exception);
      status = translated.status;
      message = translated.message;
      code = translated.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = exception.constructor.name;
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as Record<string, unknown>;
        const resMsg = resObj.message;

        if (Array.isArray(resMsg)) {
          message = resMsg.join(', ');
        } else if (typeof resMsg === 'string') {
          message = resMsg;
        } else {
          message = exception.message || 'Validation or HTTP error';
        }

        // A deliberate machine code (SETUP_REQUIRED,
        // CONTEXT_SELECTION_REQUIRED) is more useful than the exception's class
        // name. Nest fills `error` with a human reason phrase — "Not Found",
        // "Bad Request" — for its built-in exceptions, so only SCREAMING_SNAKE
        // values are treated as intentional. This keeps the codes emitted for
        // standard exceptions exactly as they were.
        if (
          typeof resObj.error === 'string' &&
          MACHINE_CODE.test(resObj.error)
        ) {
          code = resObj.error;
        }

        details = this.extractDetails(resObj);
      }
    } else if (exception instanceof Error) {
      // General application errors (do not leak database internals or stack traces)
      const errMessage = exception.message;
      if (
        errMessage.includes('prisma') ||
        errMessage.includes('PostgreSQL') ||
        errMessage.includes('relation') ||
        errMessage.includes('constraint') ||
        errMessage.includes('foreign key') ||
        errMessage.includes('unique constraint')
      ) {
        message =
          'Unable to process request due to database validation failure.';
        code = 'DATABASE_CONSTRAINT_ERROR';
      } else {
        message = errMessage;
        code = 'APPLICATION_ERROR';
      }
    }

    if (exception instanceof MaintenanceException) {
      status = exception.getStatus();
      code = 'MAINTENANCE_ACTIVE';
      message = exception.message;
      details = exception.maintenanceData;

      this.logger.warn(
        `Maintenance block [${method} ${url}]: Scope ${exception.maintenanceData.scopeType} (${exception.maintenanceData.scopeId || 'Global'}) is active`,
        'GlobalExceptionFilter',
      );
    } else {
      // Log the error using Pino LoggerService (with stack trace and details, invisible to the client)
      this.logger.error(
        `Exception [${method} ${url}]: ${message} (Code: ${code})`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    }

    // Strict client-facing JSON structure (No internal database details or stack trace)
    const body: ResponseEnvelope<null> = {
      success: false,
      message,
      data: null,
      meta: {},
      error: { code, details },
      requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  /**
   * Keeps the actionable part of a structured exception payload.
   *
   * Exceptions like `CONTEXT_SELECTION_REQUIRED` and `SETUP_REQUIRED` carry the
   * information the client needs to recover — the branches it may choose from,
   * the resources it must still create. Reducing them to a message, as this
   * filter previously did, made those responses undiagnosable.
   */
  private extractDetails(
    payload: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const entries = Object.entries(payload).filter(
      ([key]) => !ENVELOPE_KEYS.has(key),
    );

    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }
}
