export interface SensitivePattern {
  name: string;
  regex: RegExp;
}

export interface PatternScannerOptions {
  patterns?: SensitivePattern[];
}

export interface PatternScanResult {
  isSensitive: boolean;
  matches: string[];
}

const DEFAULT_PATTERNS: SensitivePattern[] = [
  {
    name: 'bearer-token',
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  },
  {
    name: 'email',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  },
  {
    name: 'password-assignment',
    regex: /(password|passwd|pwd)\s*[:=]\s*\S+/i,
  },
];

export class PatternScanner {
  private readonly patterns: SensitivePattern[];

  constructor(options: PatternScannerOptions = {}) {
    this.patterns = options.patterns ?? DEFAULT_PATTERNS;
  }

  scan(value: string): PatternScanResult {
    const matches: string[] = [];
    for (const pattern of this.patterns) {
      if (pattern.regex.test(value)) {
        matches.push(pattern.name);
      }
    }

    return {
      isSensitive: matches.length > 0,
      matches,
    };
  }
}
