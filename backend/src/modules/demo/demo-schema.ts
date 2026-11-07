import { z } from '@hono/zod-openapi';
import { validNameSchema } from '#/schemas';

export const demoSchema = z.object({
  path: z.string().describe("Where the demo opens in the app: its account's workspace board."),
  expiresAt: z.string().describe('When the demo is removed.'),
  shareCode: z.string().describe('The code of its share link, which lets a colleague join.'),
});

export const demoClaimSchema = demoSchema.extend({
  claimed: z.boolean().describe('Whether this request took the demo, or joined it; false for the one this browser held already.'),
  foldedProjectIds: z.array(z.string()).describe('The sample projects its board first opens folded.'),
});

export const demoInviteSchema = z.object({
  people: z.array(z.string()).describe('The first names of the people in the demo, its taker first; a guest without one is left out.'),
  expiresAt: z.string().describe('When the demo is removed.'),
  full: z.boolean().describe('Whether it holds as many people as a demo takes.'),
  joined: z.boolean().describe('Whether this browser is in it already.'),
});

export const demoJoinBodySchema = z.object({ firstName: validNameSchema });

export const demoShareCodeParamSchema = z.object({ shareCode: z.string().max(16) });
