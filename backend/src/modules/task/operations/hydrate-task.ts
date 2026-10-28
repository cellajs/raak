import type { z } from '@hono/zod-openapi';
import { appConfig } from 'shared';
import type { DbContext } from '#/core/context';
import { userActorRef, withActorRefs } from '#/modules/actors/actor-refs';
import type { labelEmbeddedSchema } from '#/modules/label/label-schema';
import type { TaskModel } from '#/modules/task/task-db';
import type { taskSchema } from '#/modules/task/task-schema';
import type { UserMinimalBase } from '#/modules/user/helpers/user-minimal';
import type { userMinimalBaseSchema } from '#/schemas/minimal-base';

type UserMinimalBaseSchemas = z.infer<typeof userMinimalBaseSchema>;
type Labels = z.infer<typeof labelEmbeddedSchema>;

/** A task as it reads on the wire, with embedded assignees and labels. */
export type TaskResponse = z.infer<typeof taskSchema>;

/** Map task DB models to tasks with embedded assignees and labels; the writer ids stay ids. */
const mapTask = (task: TaskModel, userMap: Map<string, UserMinimalBaseSchemas>, labelMap: Map<string, Labels>) => {
  const taskLabels = task.labels as string[];
  const taskAssignedTo = [...new Set(task.assignedTo as string[])];

  const labels = taskLabels.map((id) => labelMap.get(id)).filter(Boolean) as Labels[];
  const assignedTo = (taskAssignedTo.map((id) => userMap.get(id)).filter(Boolean) as UserMinimalBaseSchemas[]).sort((a, b) =>
    a.name.localeCompare(b.name, appConfig.defaultLanguage),
  );

  return { ...task, assignedTo, labels, primaryLabel: labelMap.get(task.primaryLabelId) ?? null };
};

/**
 * Hydrate a list of tasks with user and label data using O(1) Map lookups. Writers resolve through `withActorRefs`, the
 * members handed in as known references, so a creator who left the project still shows.
 */
export const hydrateTasks = async (
  ctx: DbContext,
  tasks: TaskModel[],
  members: UserMinimalBaseSchemas[],
  labels: Labels[],
): Promise<TaskResponse[]> => {
  const userMap = new Map(members.map((m) => [m.id, m]));
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  return withActorRefs(
    ctx,
    tasks.map((task) => mapTask(task, userMap, labelMap)),
    members.map(userActorRef),
  );
};

/** Hydrate a single task. Convenience wrapper around hydrateTasks. */
export const hydrateTask = async (ctx: DbContext, task: TaskModel, members: UserMinimalBaseSchemas[], labels: Labels[]): Promise<TaskResponse> => {
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
