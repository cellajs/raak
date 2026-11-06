import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { findSandboxPlace } from '#/modules/sandbox/sandbox-queries';

/**
 * Where a sandbox opens in the app, its account's workspace board, and when it ends.
 * @throws AppError 404 when its account has no workspace in its organization.
 */
export const sandboxAnswer = async (sandbox: SandboxModel) => {
  const place = await findSandboxPlace({ var: { db: baseDb } }, sandbox);
  if (!place) throw new AppError(404, 'not_found', 'warn', { entityType: 'workspace', meta: { sandboxId: sandbox.id } });
  return { path: `/${sandbox.tenantId}/${place.organizationSlug}/workspace/${place.workspaceSlug}`, expiresAt: sandbox.expiresAt };
};
