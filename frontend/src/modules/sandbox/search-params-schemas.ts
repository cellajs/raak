import { z } from 'zod';

/** The about page's `?sandbox=<share code>`: a link into someone's sandbox. A malformed one reads as absent. */
export const sandboxShareSearchSchema = z.object({ sandbox: z.string().max(16).optional().catch(undefined) });
