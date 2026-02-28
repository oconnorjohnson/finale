import type { ErrorCaptureOptions } from '../types/index.js';

const MAX_CAUSE_DEPTH = 5;

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

function describeUnknownError(value: unknown): { className: string; message: string } {
  if (typeof value === 'string') {
    return { className: 'Error', message: value };
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return { className: 'Error', message: String(value) };
  }

  return { className: 'UnknownError', message: 'Non-error value thrown' };
}

export function captureErrorFields(
  error: unknown,
  options: ErrorCaptureOptions = {}
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (isErrorLike(error)) {
    fields['error.class'] = error.name || 'Error';
    fields['error.message'] = error.message || 'Unknown error';
    if (options.includeStack && error.stack) {
      fields['error.stack'] = error.stack;
    }

    const causeChain = extractCauseChain(error);
    if (causeChain.length > 0) {
      fields['error.causes'] = causeChain;
    }

    return fields;
  }

  const fallback = describeUnknownError(error);
  fields['error.class'] = fallback.className;
  fields['error.message'] = fallback.message;
  return fields;
}

function extractCauseChain(error: Error): Array<{ class: string; message: string }> {
  const causes: Array<{ class: string; message: string }> = [];
  let current: unknown = error.cause;
  let depth = 0;

  while (current !== undefined && depth < MAX_CAUSE_DEPTH) {
    if (isErrorLike(current)) {
      causes.push({
        class: current.name || 'Error',
        message: current.message || 'Unknown error',
      });
      current = current.cause;
    } else {
      causes.push({
        class: 'UnknownCause',
        message: String(current),
      });
      break;
    }
    depth += 1;
  }

  return causes;
}
