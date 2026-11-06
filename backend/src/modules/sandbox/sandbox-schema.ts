import { z } from '@hono/zod-openapi';
import { validEmailSchema, validNameSchema } from '#/schemas';

export const sandboxSchema = z.object({
  path: z.string().describe("Where the sandbox opens in the app: its account's workspace board."),
  expiresAt: z.string().nullable().describe('When the sandbox is removed unless kept.'),
});

export const sandboxKeepBodySchema = z.object({
  firstName: validNameSchema,
  lastName: validNameSchema.optional(),
  email: validEmailSchema,
  organizationName: validNameSchema.optional(),
});
