import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { LoggerService } from '@/common/logger/logger.service';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';
import { PrismaErrorTranslator } from './prisma-error-translator';

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
        message = 'Unable to process request due to database validation failure.';
        code = 'DATABASE_CONSTRAINT_ERROR';
      } else {
        message = errMessage;
        code = 'APPLICATION_ERROR';
      }
    }

    // Log the error using Pino LoggerService (with stack trace and details, invisible to the client)
    this.logger.error(
      `Exception [${method} ${url}]: ${message} (Code: ${code})`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    // Strict client-facing JSON structure (No internal database details or stack trace)
    response.status(status).json({
      success: false,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

