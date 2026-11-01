import type { z } from '@hono/zod-openapi';
import type { OrgContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import type { labelOlderAcceptedCountsQuerySchema } from '#/modules/label/label-schema';
import { resolveProjectNarrowing } from '#/modules/project/project-queries';
import { countOlderAcceptedTasksByLabel } from '#/modules/task/task-queries';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { isoDateAgo } from '#/utils/iso-date';
import { TimeSpan } from '#/utils/time-span';

type GetLabelOlderAcceptedCountsInput = z.infer<typeof labelOlderAcceptedCountsQuerySchema>;

/** Label id → how many of the project's tasks were accepted before the cut-off: the tasks a board list leaves out. */
export async function getLabelOlderAcceptedCountsOp(ctx: OrgContext, { projectId, acceptedCutOff }: GetLabelOlderAcceptedCountsInput) {
  const requested = await resolveProjectNarrowing(ctx, { projectId });
  const { homeChannelIds } = resolveCollectionReadFilter(ctx.var.actor.bindings, 'task', ctx.var.organization.id, actorFrom(ctx), requested);
  if (!homeChannelIds?.length) return {};

  const acceptedBefore = isoDateAgo(new TimeSpan(acceptedCutOff, 'd'));
  const rows = await tenantRead(ctx, (readCtx) => countOlderAcceptedTasksByLabel(readCtx, { projectIds: homeChannelIds, acceptedBefore }));
  return Object.fromEntries(rows.map(({ labelId, count }) => [labelId, count]));
}
