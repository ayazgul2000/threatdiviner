import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly defaultTimeout: number;

  constructor(timeoutMs: number = 30000) {
    this.defaultTimeout = timeoutMs;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const timeoutMs = this.getTimeoutForRoute(request.path) || this.defaultTimeout;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.logger.warn(
            `Request timeout: ${request.method} ${request.url} exceeded ${timeoutMs}ms`,
          );
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  private getTimeoutForRoute(path: string): number | null {
    // Allow longer timeouts for specific routes
    const longTimeoutRoutes = [
      { pattern: /^\/scm\/scans/, timeout: 300000 }, // 5 min for scans
      { pattern: /^\/sbom\/upload/, timeout: 120000 }, // 2 min for SBOM uploads
      { pattern: /^\/export/, timeout: 120000 }, // 2 min for exports
      { pattern: /^\/threat-modeling.*\/analyze/, timeout: 180000 }, // 3 min for analysis
      { pattern: /^\/fix/, timeout: 60000 }, // 1 min for fix actions
    ];

    for (const route of longTimeoutRoutes) {
      if (route.pattern.test(path)) {
        return route.timeout;
      }
    }

    return null;
  }
}
