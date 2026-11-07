import { z } from '@hono/zod-openapi';
import { validNameSchema } from '#/schemas';

export const sandboxSchema = z.object({
  path: z.string().describe("Where the sandbox opens in the app: its account's workspace board."),
  expiresAt: z.string().describe('When the sandbox is removed.'),
  shareCode: z.string().describe('The code of its share link, which lets a colleague join.'),
});

export const sandboxClaimSchema = sandboxSchema.extend({
  claimed: z.boolean().describe('Whether this request took the sandbox, or joined it; false for the one this browser held already.'),
  foldedProjectIds: z.array(z.string()).describe('The sample projects its board first opens folded.'),
});

export const sandboxInviteSchema = z.object({
  people: z.array(z.string()).describe('The first names of the people in the sandbox, its taker first; a guest without one is left out.'),
  expiresAt: z.string().describe('When the sandbox is removed.'),
  full: z.boolean().describe('Whether it holds as many people as a sandbox takes.'),
  joined: z.boolean().describe('Whether this browser is in it already.'),
});

export const sandboxJoinBodySchema = z.object({ firstName: validNameSchema });

export const sandboxShareCodeParamSchema = z.object({ shareCode: z.string().max(16) });
