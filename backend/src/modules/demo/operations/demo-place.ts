import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { tenantReadById } from '#/db/tenant-context';
import type { DemoModel } from '#/modules/demo/demo-db';
import { findDemoPlace } from '#/modules/demo/demo-queries';
import { foldedSampleProjectIds } from '#/modules/sample/sample-content';
import { findSampleProjects } from '#/modules/sample/sample-queries';

/**
 * Where a demo opens in the app for one of its people, their workspace board, when it ends, and the code of its
 * share link.
 * @throws AppError 404 when they have no workspace in its organization.
 */
export const demoAnswer = async (demo: DemoModel, userId: string) => {
  const place = await findDemoPlace({ var: { db: baseDb } }, { userId, organizationId: demo.organizationId });
  if (!place) throw new AppError(404, 'not_found', 'warn', { entityType: 'workspace', meta: { demoId: demo.id } });
  return {
    path: `/${demo.tenantId}/${place.organizationSlug}/workspace/${place.workspaceSlug}`,
    expiresAt: demo.expiresAt,
    shareCode: demo.shareCode,
  };
};

/**
 * {@link demoAnswer} for a browser that enters the demo, with the sample projects its board first opens folded.
 * @param entered - Whether this request put the browser in it, so its board is new here.
 */
export const demoEntryAnswer = async (demo: DemoModel, userId: string, entered: boolean) => {
  const sampleProjects = await tenantReadById(demo.tenantId, (db) => findSampleProjects({ var: { db } }, { organizationId: demo.organizationId }));
  return { ...(await demoAnswer(demo, userId)), claimed: entered, foldedProjectIds: foldedSampleProjectIds(sampleProjects) };
};
