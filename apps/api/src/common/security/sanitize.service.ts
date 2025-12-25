import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizeService {
  /**
   * Sanitize string input to prevent XSS
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Remove dangerous HTML tags but keep safe formatting
   */
  stripDangerousTags(input: string): string {
    if (typeof input !== 'string') return '';

    // Remove script, iframe, object, embed, etc.
    const dangerousTags = /<\s*(script|iframe|object|embed|form|input|button|select|textarea|style|link|meta|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|form|input|button|select|textarea|style|link|meta|svg|math)[^>]*\/?>/gi;
    return input.replace(dangerousTags, '');
  }

  /**
   * Validate and sanitize file path to prevent directory traversal
   */
  sanitizeFilePath(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/\.\.\//g, '')
      .replace(/\.\.\\\\/, '')
      .replace(/^\//, '')
      .replace(/^\\/, '')
      .replace(/[<>:"|?*]/g, '');
  }

  /**
   * Validate URL to prevent SSRF
   */
  isValidUrl(input: string): boolean {
    if (typeof input !== 'string') return false;

    try {
      const url = new URL(input);
      // Block private/internal IPs
      const hostname = url.hostname.toLowerCase();

      // Block localhost and variations
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        return false;
      }

      // Only allow http and https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize SQL-like input (for logging/display, not for queries)
   */
  sanitizeSqlLike(input: string): string {
    if (typeof input !== 'string') return '';

    // Escape common SQL injection patterns for logging
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  /**
   * Validate email format
   */
  isValidEmail(input: string): boolean {
    if (typeof input !== 'string') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  }

  /**
   * Validate UUID format
   */
  isValidUuid(input: string): boolean {
    if (typeof input !== 'string') return false;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(input);
  }

  /**
   * Truncate string to max length
   */
  truncate(input: string, maxLength: number): string {
    if (typeof input !== 'string') return '';
    if (input.length <= maxLength) return input;
    return input.substring(0, maxLength);
  }

  /**
   * Remove null bytes and other control characters
   */
  removeControlCharacters(input: string): string {
    if (typeof input !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * Deep sanitize an object recursively
   */
  sanitizeObject<T>(obj: T, depth = 0): T {
    if (depth > 10) return obj; // Prevent infinite recursion

    if (typeof obj === 'string') {
      return this.removeControlCharacters(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, depth + 1)) as unknown as T;
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
      return sanitized as T;
    }

    return obj;
  }
}
