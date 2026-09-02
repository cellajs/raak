import { z } from '@hono/zod-openapi';
import { maxLength } from '#/db/utils/constraints';
import lucideIconNames from '#json/lucide-icon-names.json';

const lucideIconNameSet = new Set<string>(lucideIconNames);

/**
 * Schema for a lucide icon name. Validated against the generated sprite name list
 * (json/lucide-icon-names.json, regenerated via `pnpm --filter frontend gen:icons`) so stored
 * icons always resolve in the client sprite. App-owned: raak ships the full lucide set for
 * labels and primary labels, kept out of the shared common-schemas barrel so that file stays
 * identical to cella upstream.
 */
export const iconNameSchema = z
  .string()
  .max(maxLength.field)
  .refine((name) => lucideIconNameSet.has(name), { message: 'Unknown lucide icon name' });
