import { z } from 'zod';

/** Label-owned search params, composed into the board search schemas by the task module. */
export const labelPanelSearchSchema = z.object({
  /** Label whose tile the labels panel expands and scrolls to; cleared once handled. */
  labelPageId: z.string().optional(),
  /** Slugs of the labels whose tasks the board leaves out, '_'-joined; read with `parseHiddenLabels`. */
  hide: z.string().optional(),
});
