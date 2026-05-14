import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '@/common/logger/logger.service';
import { AuthenticatedRequest } from '@/common/logger/request-context.middleware';

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
    let message = 'Internal server error';
    let errorDetail: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as Record<string, unknown>;
        message = (resObj.message as string) || message;
        errorDetail = resObj.error;

        if (Array.isArray(message)) {
          message = message.join(', ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    this.logger.error(
      `Exception [${method} ${url}]: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    response.status(status).json({
      success: false,
      message,
      data: null,
      meta: {
        requestId,
      },
      error: {
        code:
          exception instanceof HttpException
            ? exception.constructor.name
            : 'InternalServerError',
        details: isDev
          ? errorDetail ||
            (exception instanceof Error ? exception.message : exception)
          : undefined,
      },
    });
  }
}
