import { z } from '@hono/zod-openapi';

export const sandboxSchema = z.object({
  path: z.string().describe("Where the sandbox opens in the app: its account's workspace board."),
  expiresAt: z.string().nullable().describe('When the sandbox is removed.'),
});

export const sandboxClaimSchema = sandboxSchema.extend({
  claimed: z.boolean().describe('Whether this request took the sandbox; false for the one this browser held already.'),
  foldedProjectIds: z.array(z.string()).describe('The sample projects its board first opens folded.'),
});
