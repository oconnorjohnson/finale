import type { ErrorCaptureOptions } from '../types/index.js';

const DEFAULT_MAX_CAUSE_DEPTH = 5;
const DEFAULT_PROJECTION = 'canonical';
const DEFAULT_PAYLOAD_FIELD = 'error.payload';
const MAX_SANITIZE_DEPTH = 8;

type ErrorKind =
  | 'try-error'
  | 'try-error-data'
  | 'convex-try-error'
  | 'convex-wrapper'
  | 'native-error'
  | 'unknown';

type TransportSafeValue =
  | null
  | boolean
  | number
  | string
  | TransportSafeValue[]
  | { [key: string]: TransportSafeValue };

interface TryErrorDataLike {
  __tryError?: true;
  type: string;
  message: string;
  source: string;
  timestamp: number;
  stack?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

interface BoundaryMetadata {
  code?: string;
  message?: string;
  data?: TransportSafeValue;
}

interface NormalizedTryError {
  kind: ErrorKind;
  type: string;
  message: string;
  source: string;
  timestamp: number;
  stack?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
  wrapper?: {
    class: string;
    message: string;
  };
  boundary?: BoundaryMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

function isTryErrorDataLike(value: unknown): value is TryErrorDataLike {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value['__tryError'] === true &&
    typeof value['type'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['source'] === 'string' &&
    typeof value['timestamp'] === 'number'
  );
}

function isStructuralTryError(value: unknown): value is TryErrorDataLike {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['type'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['source'] === 'string' &&
    typeof value['timestamp'] === 'number'
  );
}

function isConvexTryErrorDataLike(value: unknown): value is TryErrorDataLike & { kind: 'tryError' } {
  return isRecord(value) && value['kind'] === 'tryError' && isTryErrorDataLike(value);
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

function sanitizeTransportValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): TransportSafeValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined') {
    return '[Undefined]';
  }

  if (typeof value === 'symbol') {
    return value.description ? `[Symbol(${value.description})]` : '[Symbol]';
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[MaxDepthExceeded]';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeTransportValue(entry, seen, depth + 1));
  }

  if (isRecord(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    const sanitized: Record<string, TransportSafeValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      sanitized[key] = sanitizeTransportValue(entry, seen, depth + 1);
    }
    return sanitized;
  }

  return String(value);
}

function normalizeTryErrorData(value: TryErrorDataLike, kind: ErrorKind): NormalizedTryError {
  return {
    kind,
    type: value.type,
    message: value.message,
    source: value.source,
    timestamp: value.timestamp,
    ...(typeof value.stack === 'string' ? { stack: value.stack } : {}),
    ...(isRecord(value.context) ? { context: value.context } : {}),
    ...(value.cause !== undefined ? { cause: value.cause } : {}),
  };
}

function getBoundaryMetadata(value: unknown): BoundaryMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const metadata: BoundaryMetadata = {};

  if (typeof value['code'] === 'string') {
    metadata.code = value['code'];
  }

  if (typeof value['message'] === 'string') {
    metadata.message = value['message'];
  }

  if ('data' in value && value['data'] !== undefined) {
    metadata.data = sanitizeTransportValue(value['data']);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeWrappedTryError(error: Error): NormalizedTryError | null {
  const wrapper = {
    class: error.name || 'Error',
    message: error.message || 'Unknown error',
  };

  const data = isRecord(error) ? error['data'] : undefined;
  if (isRecord(data)) {
    const directPayload = data['error'];
    if (isConvexTryErrorDataLike(directPayload)) {
      const boundary = getBoundaryMetadata(data);
      return {
        ...normalizeTryErrorData(directPayload, 'convex-wrapper'),
        wrapper,
        ...(boundary ? { boundary } : {}),
      };
    }

    if (isConvexTryErrorDataLike(data)) {
      const boundary = getBoundaryMetadata(data);
      return {
        ...normalizeTryErrorData(data, 'convex-wrapper'),
        wrapper,
        ...(boundary ? { boundary } : {}),
      };
    }
  }

  const cause = error.cause;
  if (isTryErrorDataLike(cause)) {
    return {
      ...normalizeTryErrorData(cause, 'convex-wrapper'),
      wrapper,
    };
  }

  if (isStructuralTryError(cause)) {
    return {
      ...normalizeTryErrorData(cause, 'convex-wrapper'),
      wrapper,
    };
  }

  return null;
}

function detectTryError(error: unknown, unwrapBoundaryErrors: boolean): NormalizedTryError | null {
  if (isConvexTryErrorDataLike(error)) {
    return normalizeTryErrorData(error, 'convex-try-error');
  }

  if (isTryErrorDataLike(error)) {
    return normalizeTryErrorData(error, 'try-error-data');
  }

  if (isStructuralTryError(error)) {
    return normalizeTryErrorData(error, 'try-error');
  }

  if (unwrapBoundaryErrors && isErrorLike(error)) {
    return normalizeWrappedTryError(error);
  }

  return null;
}

function extractCauseChain(
  cause: unknown,
  maxCauseDepth: number
): Array<{ class: string; message: string }> {
  const causes: Array<{ class: string; message: string }> = [];
  const seen = new WeakSet<object>();
  let current = cause;
  let depth = 0;

  while (current !== undefined && depth < maxCauseDepth) {
    if (isRecord(current)) {
      if (seen.has(current)) {
        causes.push({
          class: 'CircularCause',
          message: '[Circular]',
        });
        break;
      }

      seen.add(current);
    }

    if (isConvexTryErrorDataLike(current)) {
      causes.push({ class: current.type, message: current.message });
      current = current.cause;
      depth += 1;
      continue;
    }

    if (isTryErrorDataLike(current) || isStructuralTryError(current)) {
      causes.push({ class: current.type, message: current.message });
      current = current.cause;
      depth += 1;
      continue;
    }

    if (isErrorLike(current)) {
      causes.push({
        class: current.name || 'Error',
        message: current.message || 'Unknown error',
      });
      current = current.cause;
      depth += 1;
      continue;
    }

    causes.push({
      class: 'UnknownCause',
      message: String(current),
    });
    break;
  }

  return causes;
}

function buildMirroredPayload(normalized: NormalizedTryError): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    kind: normalized.kind,
    error: {
      __tryError: true,
      type: normalized.type,
      message: normalized.message,
      source: normalized.source,
      timestamp: normalized.timestamp,
      ...(normalized.stack ? { stack: normalized.stack } : {}),
      ...(normalized.context ? { context: sanitizeTransportValue(normalized.context) } : {}),
      ...(normalized.cause !== undefined ? { cause: sanitizeTransportValue(normalized.cause) } : {}),
    },
  };

  if (normalized.wrapper) {
    payload['wrapper'] = normalized.wrapper;
  }

  if (normalized.boundary) {
    payload['boundary'] = normalized.boundary;
  }

  return payload;
}

function addCanonicalTryErrorFields(
  fields: Record<string, unknown>,
  normalized: NormalizedTryError,
  options: Required<Pick<ErrorCaptureOptions, 'includeStack' | 'maxCauseDepth'>> &
    Pick<ErrorCaptureOptions, 'projection' | 'payloadField'>
): void {
  fields['error.class'] = normalized.type;
  fields['error.message'] = normalized.message;

  if (options.includeStack && normalized.stack) {
    fields['error.stack'] = normalized.stack;
  }

  const causeChain = extractCauseChain(normalized.cause, options.maxCauseDepth);
  if (causeChain.length > 0) {
    fields['error.causes'] = causeChain;
  }

  if (options.projection === 'canonical') {
    return;
  }

  fields['error.kind'] = normalized.kind;
  fields['error.source'] = normalized.source;
  fields['error.timestamp'] = normalized.timestamp;

  if (normalized.context) {
    fields['error.context'] = sanitizeTransportValue(normalized.context);
  }

  if (normalized.cause !== undefined) {
    fields['error.cause'] = sanitizeTransportValue(normalized.cause);
  }

  if (normalized.wrapper) {
    fields['error.wrapper.class'] = normalized.wrapper.class;
    fields['error.wrapper.message'] = normalized.wrapper.message;
  }

  if (normalized.boundary?.code) {
    fields['error.boundary.code'] = normalized.boundary.code;
  }

  if (normalized.boundary?.message) {
    fields['error.boundary.message'] = normalized.boundary.message;
  }

  if (normalized.boundary?.data !== undefined) {
    fields['error.boundary.data'] = normalized.boundary.data;
  }

  if (options.projection === 'mirror') {
    fields[options.payloadField ?? DEFAULT_PAYLOAD_FIELD] = buildMirroredPayload(normalized);
  }
}

export function captureErrorFields(
  error: unknown,
  options: ErrorCaptureOptions = {}
): Record<string, unknown> {
  const projection = options.projection ?? DEFAULT_PROJECTION;
  const includeStack = options.includeStack ?? false;
  const unwrapBoundaryErrors = options.unwrapBoundaryErrors ?? true;
  const maxCauseDepth = options.maxCauseDepth ?? DEFAULT_MAX_CAUSE_DEPTH;
  const payloadField = options.payloadField ?? DEFAULT_PAYLOAD_FIELD;
  const fields: Record<string, unknown> = {};

  const tryError = detectTryError(error, unwrapBoundaryErrors);
  if (tryError) {
    addCanonicalTryErrorFields(fields, tryError, {
      projection,
      includeStack,
      maxCauseDepth,
      payloadField,
    });
    return fields;
  }

  if (isErrorLike(error)) {
    fields['error.class'] = error.name || 'Error';
    fields['error.message'] = error.message || 'Unknown error';

    if (includeStack && error.stack) {
      fields['error.stack'] = error.stack;
    }

    const causeChain = extractCauseChain(error.cause, maxCauseDepth);
    if (causeChain.length > 0) {
      fields['error.causes'] = causeChain;
    }

    if (projection !== 'canonical') {
      fields['error.kind'] = 'native-error';
      if (error.cause !== undefined) {
        fields['error.cause'] = sanitizeTransportValue(error.cause);
      }
    }

    return fields;
  }

  const fallback = describeUnknownError(error);
  fields['error.class'] = fallback.className;
  fields['error.message'] = fallback.message;

  if (projection !== 'canonical') {
    fields['error.kind'] = 'unknown';
  }

  return fields;
}
