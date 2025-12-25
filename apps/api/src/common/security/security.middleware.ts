import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private readonly suspiciousPatterns = [
    // SQL injection patterns
    /(\bunion\b.*\bselect\b|\binsert\b.*\binto\b|\bdelete\b.*\bfrom\b|\bdrop\b.*\btable\b)/i,
    // XSS patterns
    /<script[^>]*>[\s\S]*?<\/script>/i,
    // Command injection patterns
    /(\||;|`|\$\()/,
    // Path traversal
    /\.\.\//,
    // Null byte injection
    /%00/,
  ];

  use(req: Request, _res: Response, next: NextFunction): void {
    // Log security-relevant info (sanitized)
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Check for suspicious patterns in URL and body
    const urlAndBody = [
      req.originalUrl,
      JSON.stringify(req.body || {}),
      JSON.stringify(req.query || {}),
    ].join(' ');

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(urlAndBody)) {
        this.logger.warn(`Suspicious request detected from ${ip}: ${req.method} ${req.path}`, {
          pattern: pattern.source,
          userAgent,
        });
        // Don't block, but log for analysis
        break;
      }
    }

    // Add security headers
    _res.setHeader('X-Content-Type-Options', 'nosniff');
    _res.setHeader('X-Frame-Options', 'DENY');
    _res.setHeader('X-XSS-Protection', '1; mode=block');
    _res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    _res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Remove server identification header
    _res.removeHeader('X-Powered-By');

    next();
  }
}
