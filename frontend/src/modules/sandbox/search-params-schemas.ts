import { z } from 'zod';

/** The about page's `?demo=<share code>`: a link into someone's demo board. A malformed one reads as absent. */
export const sandboxShareSearchSchema = z.object({ demo: z.string().max(16).optional().catch(undefined) });
