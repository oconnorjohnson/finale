import { describe, expect, it } from 'vitest';
import { captureErrorFields } from './error-capture.js';

describe('error capture', () => {
  it('normalizes standard Error values', () => {
    const err = new TypeError('bad input');
    const fields = captureErrorFields(err);

    expect(fields['error.class']).toBe('TypeError');
    expect(fields['error.message']).toBe('bad input');
    expect(fields['error.stack']).toBeUndefined();
  });

  it('includes stack traces when requested', () => {
    const err = new Error('boom');
    const fields = captureErrorFields(err, { includeStack: true });

    expect(typeof fields['error.stack']).toBe('string');
  });

  it('captures bounded cause chains', () => {
    const cause = new Error('root cause');
    const err = new Error('top level', { cause });

    const fields = captureErrorFields(err);

    expect(fields['error.causes']).toEqual([{ class: 'Error', message: 'root cause' }]);
  });

  it('handles unknown thrown values', () => {
    const fields = captureErrorFields('string failure');
    expect(fields['error.class']).toBe('Error');
    expect(fields['error.message']).toBe('string failure');
  });
});
