import { Test, TestingModule } from '@nestjs/testing';
import { SanitizeService } from './sanitize.service';

describe('SanitizeService', () => {
  let service: SanitizeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizeService],
    }).compile();

    service = module.get<SanitizeService>(SanitizeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeString', () => {
    it('should escape HTML special characters', () => {
      expect(service.sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(service.sanitizeString('foo & bar')).toBe('foo &amp; bar');
    });

    it('should handle empty strings', () => {
      expect(service.sanitizeString('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(service.sanitizeString(null as any)).toBe('');
      expect(service.sanitizeString(undefined as any)).toBe('');
    });
  });

  describe('stripDangerousTags', () => {
    it('should remove script tags', () => {
      expect(service.stripDangerousTags('<p>Hello</p><script>evil()</script>')).toBe('<p>Hello</p>');
    });

    it('should remove iframe tags', () => {
      expect(service.stripDangerousTags('<iframe src="evil.com"></iframe>')).toBe('');
    });

    it('should remove self-closing dangerous tags', () => {
      expect(service.stripDangerousTags('<input type="text" />')).toBe('');
    });

    it('should preserve safe content', () => {
      expect(service.stripDangerousTags('Hello World')).toBe('Hello World');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should remove directory traversal sequences', () => {
      expect(service.sanitizeFilePath('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('should remove leading slashes', () => {
      expect(service.sanitizeFilePath('/etc/passwd')).toBe('etc/passwd');
    });

    it('should remove invalid characters', () => {
      expect(service.sanitizeFilePath('file<>:"|?*.txt')).toBe('file.txt');
    });

    it('should handle normal paths', () => {
      expect(service.sanitizeFilePath('src/app/main.ts')).toBe('src/app/main.ts');
    });
  });

  describe('isValidUrl', () => {
    it('should accept valid external URLs', () => {
      expect(service.isValidUrl('https://github.com/repo')).toBe(true);
      expect(service.isValidUrl('http://example.com')).toBe(true);
    });

    it('should reject localhost', () => {
      expect(service.isValidUrl('http://localhost:3000')).toBe(false);
      expect(service.isValidUrl('http://127.0.0.1:8080')).toBe(false);
    });

    it('should reject private IP ranges', () => {
      expect(service.isValidUrl('http://192.168.1.1')).toBe(false);
      expect(service.isValidUrl('http://10.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://172.16.0.1')).toBe(false);
    });

    it('should reject non-HTTP protocols', () => {
      expect(service.isValidUrl('file:///etc/passwd')).toBe(false);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(service.isValidUrl('not-a-url')).toBe(false);
      expect(service.isValidUrl('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(service.isValidEmail('user@example.com')).toBe(true);
      expect(service.isValidEmail('user.name@sub.domain.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(service.isValidEmail('not-an-email')).toBe(false);
      expect(service.isValidEmail('@domain.com')).toBe(false);
      expect(service.isValidEmail('user@')).toBe(false);
    });
  });

  describe('isValidUuid', () => {
    it('should accept valid UUIDs', () => {
      expect(service.isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(service.isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(service.isValidUuid('not-a-uuid')).toBe(false);
      expect(service.isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(service.isValidUuid('')).toBe(false);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(service.truncate('Hello World', 5)).toBe('He...');
    });

    it('should not truncate short strings', () => {
      expect(service.truncate('Hi', 10)).toBe('Hi');
    });

    it('should handle empty strings', () => {
      expect(service.truncate('', 10)).toBe('');
    });
  });

  describe('removeControlCharacters', () => {
    it('should remove null bytes', () => {
      expect(service.removeControlCharacters('hello\x00world')).toBe('helloworld');
    });

    it('should remove other control characters', () => {
      expect(service.removeControlCharacters('test\x01\x02\x03')).toBe('test');
    });

    it('should preserve normal text', () => {
      expect(service.removeControlCharacters('Hello World!')).toBe('Hello World!');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: 'test\x00',
        nested: {
          value: 'hello\x01',
        },
      };

      const result = service.sanitizeObject(input);

      expect(result.name).toBe('test');
      expect(result.nested.value).toBe('hello');
    });

    it('should sanitize arrays', () => {
      const input = ['test\x00', 'hello\x01'];
      const result = service.sanitizeObject(input);

      expect(result).toEqual(['test', 'hello']);
    });

    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: 'test\x00',
            },
          },
        },
      };

      const result = service.sanitizeObject(input);
      expect(result.level1.level2.level3.value).toBe('test');
    });

    it('should preserve non-string values', () => {
      const input = {
        number: 42,
        boolean: true,
        nullValue: null,
      };

      const result = service.sanitizeObject(input);

      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBeNull();
    });
  });
});
