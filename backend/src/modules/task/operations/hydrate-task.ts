import type { z } from '@hono/zod-openapi';
import { appConfig } from 'shared';
import type { DbContext } from '#/core/context';
import { userActorRef, withActorRefs } from '#/modules/actors/actor-refs';
import type { labelEmbeddedSchema } from '#/modules/label/label-schema';
import type { TaskModel } from '#/modules/task/task-db';
import type { taskSchema } from '#/modules/task/task-schema';
import type { UserMinimalBase } from '#/modules/user/helpers/user-minimal';

type EmbeddedLabel = z.infer<typeof labelEmbeddedSchema>;

/** A task as it reads on the wire, with embedded assignees and labels. */
export type TaskResponse = z.infer<typeof taskSchema>;

/** Map task DB models to tasks with embedded assignees and labels; the writer ids stay ids. */
const mapTask = (task: TaskModel, userMap: Map<string, UserMinimalBase>, labelMap: Map<string, EmbeddedLabel>) => {
  const labels = task.labels.flatMap((id) => labelMap.get(id) ?? []);
  const assignedTo = [...new Set(task.assignedTo)]
    .flatMap((id) => userMap.get(id) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, appConfig.defaultLanguage));

  return { ...task, assignedTo, labels, primaryLabel: labelMap.get(task.primaryLabelId) ?? null };
};

/**
 * Hydrate tasks with their assignees and labels. Writers resolve through `withActorRefs`, the members handed in as known
 * references, so a creator who left the project still shows.
 */
export const hydrateTasks = async (
  ctx: DbContext,
  tasks: TaskModel[],
  members: UserMinimalBase[],
  labels: EmbeddedLabel[],
): Promise<TaskResponse[]> => {
  const userMap = new Map(members.map((m) => [m.id, m]));
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  return withActorRefs(
    ctx,
    tasks.map((task) => mapTask(task, userMap, labelMap)),
    members.map(userActorRef),
  );
};

/** `hydrateTasks` for one task. */
export const hydrateTask = async (ctx: DbContext, task: TaskModel, members: UserMinimalBase[], labels: EmbeddedLabel[]): Promise<TaskResponse> => {
  const [hydrated] = await hydrateTasks(ctx, [task], members, labels);
  return hydrated;
};

/**
 * Lightweight task hydration that skips relation DB queries entirely.
 * Returns stub arrays for labels/assignedTo and builds updatedBy from the current user, if any.
 */
export const hydrateTaskLite = (
  task: TaskModel,
  currentUser: Pick<UserMinimalBase, 'id' | 'name' | 'slug' | 'thumbnailUrl'> | undefined,
): TaskResponse => ({
  ...task,
  labels: [],
  assignedTo: [],
  primaryLabel: null,
  createdBy: null,
  updatedBy: currentUser ? userActorRef(currentUser) : null,
  deletedBy: null,
});
