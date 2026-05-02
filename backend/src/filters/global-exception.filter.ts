import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/request-context.middleware';
import { LoggerService } from '@/infrastructure/logger/logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();
    const traceId = request.context?.requestId || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetail = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || message;
        errorDetail = (exceptionResponse as any).error;
        
        if (Array.isArray(message)) {
          message = message.join(', ');
        }
      }
    } else if (exception instanceof Error) {
      // It's a standard error, hide it from the client in production,
      // but for consistency we use a generic message or the error message if needed.
      // Usually, we shouldn't expose internal error messages.
      message = 'Internal server error';
    }

    this.logger.error(
      `Exception thrown: ${exception instanceof Error ? exception.message : message}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter'
    );

    response.status(status).json({
      success: false,
      message,
      traceId,
      ...(errorDetail && { error: errorDetail }),
    });
  }
}
