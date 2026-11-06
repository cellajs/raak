import { z } from '@hono/zod-openapi';
import { validIdSchema } from '#/schemas';

export const sampleProvisionQuerySchema = z.object({
  workspaceId: validIdSchema.optional().describe('The workspace the caller files the sample projects under; their first one when absent.'),
});

export const sampleProvisionResponseSchema = z.object({
  created: z.boolean().describe('Whether this request wrote the sample; false when the organization had it and the caller joined it.'),
  projectIds: z.array(z.string()),
});
