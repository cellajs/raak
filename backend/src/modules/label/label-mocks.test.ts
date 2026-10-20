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

  it('gives a mock label the slug the slug schema derives from its name', () => {
    const label = mockLabel('label:test');
    expect(label.slug).toBe(labelSlugSchema.parse(label.name));
  });
});
