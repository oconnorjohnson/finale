import { describe, expect, it } from 'vitest';
import { PatternScanner } from './pattern-scanner.js';

describe('pattern scanner', () => {
  it('detects default sensitive patterns', () => {
    const scanner = new PatternScanner();

    expect(scanner.scan('Authorization: Bearer abc.def.ghi').isSensitive).toBe(true);
    expect(scanner.scan('alice@example.com').isSensitive).toBe(true);
    expect(scanner.scan('password=supersecret').isSensitive).toBe(true);
  });

  it('returns matched pattern names', () => {
    const scanner = new PatternScanner();
    const result = scanner.scan('Contact alice@example.com');

    expect(result.matches).toContain('email');
  });

  it('supports custom pattern configuration', () => {
    const scanner = new PatternScanner({
      patterns: [{ name: 'custom', regex: /internal-secret/i }],
    });

    expect(scanner.scan('internal-secret token').matches).toEqual(['custom']);
    expect(scanner.scan('alice@example.com').isSensitive).toBe(false);
  });
});
