import { z } from 'zod';

/** Label-owned search params, composed into the board search schemas by the task module. */
export const labelPanelSearchSchema = z.object({
  /** Label whose page is open in the labels board panel (replaces the panel's table). */
  labelPageId: z.string().optional(),
});
