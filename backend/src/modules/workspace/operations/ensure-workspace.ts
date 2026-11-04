import { sql } from 'drizzle-orm';
import { hierarchy } from 'shared';
import type { DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { generateUniqueSlugs } from '#/modules/entities/operations/generate-unique-slugs';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { findUserWorkspaceId, insertWorkspaces } from '#/modules/workspace/workspace-queries';
import { log } from '#/utils/logger';

interface InsertHeldWorkspacesOpts {
  holder: { id: string; slug: string };
  organization: { id: string; slug: string; tenantId: string };
  names: string[];
}

/**
 * Inserts workspaces with their holder as admin and slugs derived from holder and organization. Call it inside a
 * transaction: a workspace without its admin reaches no one.
 */
export async function insertHeldWorkspaces(ctx: DbContext, { holder, organization, names }: InsertHeldWorkspacesOpts) {
  const slugs = await generateUniqueSlugs(
    ctx,
    names.map(() => `${holder.slug}-${organization.slug}`),
    'workspace',
  );
  const workspaceRecords = await insertWorkspaces(ctx, {
    workspaces: names.map((name, index) => ({
      name,
      slug: slugs[index],
      createdBy: holder.id,
      tenantId: organization.tenantId,
      organizationId: organization.id,
    })),
  });
  const createdMemberships = await insertMemberships(ctx, {
    items: workspaceRecords.map((workspace) => ({
      userId: holder.id,
      createdBy: holder.id,
      role: hierarchy.getMostPrivilegedRole('workspace'),
      entity: workspace,
    })),
  });
  return { workspaceRecords, createdMemberships };
}

interface EnsureUserWorkspaceOpts {
  userId: string;
  organizationId: string;
  /** Workspaces that do not count, such as ones being deleted. */
  exceptIds?: string[];
}

/**
 * The id of the user's first workspace in the organization, or of a new one named after the organization.
 * Call it inside a transaction. A new workspace skips the quota and permission checks of `createWorkspacesOp`: the
 * caller may be someone else, and an invitation must not fail on a limit the invitee has no say in.
 */
export async function ensureUserWorkspace(ctx: DbContext, { userId, organizationId, exceptIds }: EnsureUserWorkspaceOpts): Promise<string> {
  const existingId = await findUserWorkspaceId(ctx, { userId, organizationId, exceptIds });
  if (existingId) return existingId;

  // Two accepts by one person would each create a workspace. The lock holds until commit, so the second finds the first's.
  await ctx.var.db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`user_workspace:${userId}:${organizationId}`}, 0))`);
  const lockedId = await findUserWorkspaceId(ctx, { userId, organizationId, exceptIds });
  if (lockedId) return lockedId;

  const [holder, organization] = await Promise.all([
    resolveEntity(ctx, { entityType: 'user', identifier: userId }),
    resolveEntity(ctx, { entityType: 'organization', identifier: organizationId }),
  ]);
  if (!holder) throw new AppError(404, 'not_found', 'error', { entityType: 'user' });
  if (!organization) throw new AppError(404, 'not_found', 'error', { entityType: 'organization' });

  const { workspaceRecords } = await insertHeldWorkspaces(ctx, { holder, organization, names: [organization.name] });
  log.info('Workspace created for a project membership', { workspaceId: workspaceRecords[0].id });
  return workspaceRecords[0].id;
}
