import type { FieldDefinition, FieldRegistry } from '../types/index.js';
import { safeParseWithSchema } from './schema-adapter.js';

export type ValidationMode = 'strict' | 'soft';

export interface ValidationIssue {
  key: string;
  reason: 'unknown_field' | 'invalid_type';
  message: string;
}

export interface ValidationResult {
  accepted: Record<string, unknown>;
  dropped: string[];
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  fields: Record<string, unknown>;
  registry: FieldRegistry;
  mode: ValidationMode;
  onIssue?: (issue: ValidationIssue) => void;
}

function createIssue(key: string, reason: ValidationIssue['reason'], message: string): ValidationIssue {
  return { key, reason, message };
}

export function validateFields(options: ValidationOptions): ValidationResult {
  const accepted: Record<string, unknown> = {};
  const dropped: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const [key, value] of Object.entries(options.fields)) {
    const fieldDefinition: FieldDefinition | undefined = options.registry[key];

    if (!fieldDefinition) {
      const issue = createIssue(key, 'unknown_field', `Unknown field: ${key}`);
      issues.push(issue);
      options.onIssue?.(issue);
      if (options.mode === 'soft') {
        dropped.push(key);
        continue;
      }
      accepted[key] = value;
      continue;
    }

    const result = safeParseWithSchema(fieldDefinition.type, value);
    if (result.success) {
      accepted[key] = result.data;
      continue;
    }

    const issue = createIssue(key, 'invalid_type', `Invalid value for field: ${key}`);
    issues.push(issue);
    options.onIssue?.(issue);
    if (options.mode === 'soft') {
      dropped.push(key);
      continue;
    }
    accepted[key] = value;
  }

  return { accepted, dropped, issues };
}
