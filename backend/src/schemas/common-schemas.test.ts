import { appConfig } from 'shared';
import { describe, expect, it } from 'vitest';
import { booleanTransformSchema, paginationQuerySchema } from './common-schemas';

describe('booleanTransformSchema', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    [false, false],
    [true, true],
  ])('parses %j as %j', (input, expected) => {
    expect(booleanTransformSchema.parse(input)).toBe(expected);
  });

  it.each(['', '0', '1', 'TRUE', 'garbage', 0, 1])('rejects non-boolean input %j', (input) => {
    expect(booleanTransformSchema.safeParse(input).success).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  it('applies pagination defaults when parameters are absent', () => {
    expect(paginationQuerySchema.parse({})).toMatchObject({
      offset: 0,
      limit: appConfig.requestLimits.default,
    });
  });

  it('parses complete unsigned integer strings', () => {
    expect(paginationQuerySchema.parse({ offset: '12', limit: '39' })).toMatchObject({
      offset: 12,
      limit: 39,
    });
  });

  it.each([
    { offset: '' },
    { offset: '-1' },
    { offset: '1.5' },
    { offset: '12junk' },
    { offset: '9007199254740992' },
    { limit: '' },
    { limit: '0' },
    { limit: '1.5' },
    { limit: '3items' },
    { limit: '1001' },
    { limit: '9007199254740992' },
  ])('rejects malformed or out-of-range pagination input %j', (input) => {
    expect(paginationQuerySchema.safeParse(input).success).toBe(false);
  });

  it('accepts a bounded sequence cursor', () => {
    expect(paginationQuerySchema.parse({ seqCursor: '51,150' }).seqCursor).toBe('51,150');
  });

  it.each(['51', '51,', 'a,150', '151,150', '0,9007199254740992'])(
    'rejects invalid sequence cursor %s',
    (seqCursor) => {
      expect(paginationQuerySchema.safeParse({ seqCursor }).success).toBe(false);
    },
  );
});
