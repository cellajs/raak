import { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { validIdSchema } from '#/schemas';

/**
 * Attachment placement seam, filled for raak: attachments are homed on a project (the parent
 * channel in raak's hierarchy), so every create-body item must name the project and the
 * resolved row carries it as its home column. The cella-owned schema and create op call
 * through this file, so the fork axis stays local to it.
 */
export const attachmentPlacementFieldsSchema = {
  projectId: validIdSchema,
};

export type AttachmentPlacementInput = { projectId: string } & Record<string, unknown>;

export type ResolvedAttachmentPlacement = { projectId: string };

const placementInputSchema = z.object({ projectId: validIdSchema });

/** Per-item create-body validation; the schema already requires exactly one home id, so nothing is ambiguous. */
export const validateAttachmentPlacement = (
  item: AttachmentPlacementInput,
): { path: (string | number)[]; message: string } | null => {
  const parsed = placementInputSchema.safeParse(item);
  if (parsed.success) return null;
  return { path: ['projectId'], message: 'projectId is required' };
};

/**
 * The project id is stamped as the home column. Membership on that project is enforced by the
 * create op's `canCreateEntity` check, which reads the hierarchy ancestors off the resolved row.
 */
export const resolveAttachmentPlacement = async (
  _ctx: AuthContext,
  input: AttachmentPlacementInput,
): Promise<ResolvedAttachmentPlacement> => ({ projectId: input.projectId });
