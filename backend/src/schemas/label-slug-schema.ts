import { z } from '@hono/zod-openapi';
import { labelSlug } from 'shared';
import { maxLength } from '#/db/utils/constraints';

/** Canonical label identity used for cross-project grouping and organization tracking. */
export const labelSlugSchema = z
  .string()
  .max(maxLength.field)
  .transform(labelSlug)
  .pipe(
    z
      .string()
      .min(1)
      .max(maxLength.field)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  );
