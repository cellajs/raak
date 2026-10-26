import { labelName } from 'shared/config/labels-config';
import { describe, expect, it } from 'vitest';
import { labelSlugSchema } from '#/schemas/label-slug-schema';
import { mockLabel, mockLabelNames } from './label-mocks';

describe('label mocks', () => {
  it('gives names label creation stores unchanged, each with its own valid slug', () => {
    const names = mockLabelNames(100);
    const slugs = names.map((name) => labelSlugSchema.parse(name));

    expect(names).toHaveLength(100);
    expect(names.filter((name) => labelName(name, 'secondary') !== name)).toEqual([]);
    expect(new Set(slugs).size).toBe(names.length);
  });

  it('names a mock label by its slug', () => {
    const label = mockLabel('label:test', 'Focus Group');
    expect(label.name).toBe('focus-group');
    expect(label.slug).toBe(label.name);
  });
});
