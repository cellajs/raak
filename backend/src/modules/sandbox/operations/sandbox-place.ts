import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { tenantReadById } from '#/db/tenant-context';
import { foldedSampleProjectIds } from '#/modules/sample/sample-content';
import { findSampleProjects } from '#/modules/sample/sample-queries';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { findSandboxPlace } from '#/modules/sandbox/sandbox-queries';

/**
 * Where a sandbox opens in the app for one of its people, their workspace board, when it ends, and the code of its
 * share link.
 * @throws AppError 404 when they have no workspace in its organization.
 */
export const sandboxAnswer = async (sandbox: SandboxModel, userId: string) => {
  const place = await findSandboxPlace({ var: { db: baseDb } }, { userId, organizationId: sandbox.organizationId });
  if (!place) throw new AppError(404, 'not_found', 'warn', { entityType: 'workspace', meta: { sandboxId: sandbox.id } });
  return {
    path: `/${sandbox.tenantId}/${place.organizationSlug}/workspace/${place.workspaceSlug}`,
    expiresAt: sandbox.expiresAt,
    shareCode: sandbox.shareCode,
  };
};

/**
 * {@link sandboxAnswer} for a browser that enters the sandbox, with the sample projects its board first opens folded.
 * @param entered - Whether this request put the browser in it, so its board is new here.
 */
export const sandboxEntryAnswer = async (sandbox: SandboxModel, userId: string, entered: boolean) => {
  const sampleProjects = await tenantReadById(sandbox.tenantId, (db) =>
    findSampleProjects({ var: { db } }, { organizationId: sandbox.organizationId }),
  );
  return { ...(await sandboxAnswer(sandbox, userId)), claimed: entered, foldedProjectIds: foldedSampleProjectIds(sampleProjects) };
};
