import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error, details } = this.extractErrorInfo(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      details,
    };

    // Log the error with full context
    this.logError(exception, request, status);

    response.status(status).json(errorResponse);
  }

  private extractErrorInfo(exception: unknown): {
    status: number;
    message: string;
    error?: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          status,
          message: response,
          error: HttpStatus[status],
        };
      }

      const responseObj = response as Record<string, unknown>;
      return {
        status,
        message:
          (responseObj.message as string) ||
          (responseObj.error as string) ||
          'An error occurred',
        error: (responseObj.error as string) || HttpStatus[status],
        details: responseObj.details,
      };
    }

    // Handle Prisma errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception);
    }

    // Handle other errors
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Internal server error',
        error: exception.name,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'InternalServerError',
    };
  }

  private isPrismaError(exception: unknown): boolean {
    return (
      exception !== null &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string' &&
      (exception as { code: string }).code.startsWith('P')
    );
  }

  private handlePrismaError(exception: unknown): {
    status: number;
    message: string;
    error: string;
  } {
    const prismaError = exception as { code: string; meta?: { target?: string[] } };

    switch (prismaError.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: `Duplicate value for ${prismaError.meta?.target?.join(', ') || 'field'}`,
          error: 'ConflictError',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'NotFoundError',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          error: 'RelationError',
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid relation',
          error: 'RelationError',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'DatabaseError',
        };
    }
  }

  private logError(exception: unknown, request: Request, status: number): void {
    const logData = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      status,
      userAgent: request.headers['user-agent'],
      ip:
        request.headers['x-forwarded-for'] ||
        request.headers['x-real-ip'] ||
        request.ip,
    };

    if (status >= 500) {
      this.logger.error(
        `[${logData.method}] ${logData.url} - ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logData),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${logData.method}] ${logData.url} - ${status}`,
        JSON.stringify(logData),
      );
    }
  }
}
