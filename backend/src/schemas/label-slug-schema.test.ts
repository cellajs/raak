import { describe, expect, it } from 'vitest';
import { labelSlugSchema } from './label-slug-schema';

describe('labelSlugSchema', () => {
  it('canonicalizes label slugs with the shared label normalizer', () => {
    expect(labelSlugSchema.parse(' Bug Fix! ')).toBe('bug-fix');
  });

  it.each(['!!!', '---', ''])('rejects an empty normalized label slug from %j', (slug) => {
    expect(labelSlugSchema.safeParse(slug).success).toBe(false);
  });
});
