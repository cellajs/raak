import type { z } from '@hono/zod-openapi';
import { appConfig } from 'shared';
import type { AuthContext } from '#/core/context';
import type { labelEmbeddedSchema } from '#/modules/label/label-schema';
import type { TaskModel } from '#/modules/task/task-db';
import { findTaskRelations } from '#/modules/task/task-queries';
import type { taskSchema } from '#/modules/task/task-schema';
import type { UserMinimalBase } from '#/modules/user/helpers/audit-user';
import { toUserMinimalBase } from '#/modules/user/helpers/audit-user';
import type { userMinimalBaseSchema } from '#/schemas/user-minimal-base';

type UserMinimalBaseSchemas = z.infer<typeof userMinimalBaseSchema>;
type Labels = z.infer<typeof labelEmbeddedSchema>;

type ReturnTask = z.infer<typeof taskSchema>;

/** Map task DB models to hydrated task responses with user and label data. */
const mapTask = (
  task: TaskModel,
  userMap: Map<string, UserMinimalBaseSchemas>,
  labelMap: Map<string, Labels>,
): ReturnTask => {
  const taskLabels = task.labels as string[];
  const taskAssignedTo = [...new Set(task.assignedTo as string[])];

  const labels = taskLabels.map((id) => labelMap.get(id)).filter(Boolean) as Labels[];
  const assignedTo = (taskAssignedTo.map((id) => userMap.get(id)).filter(Boolean) as UserMinimalBaseSchemas[]).sort(
    (a, b) => a.name.localeCompare(b.name, appConfig.defaultLanguage),
  );

  return {
    ...task,
    stx: task.stx,
    createdBy: task.createdBy ? (userMap.get(task.createdBy) ?? null) : null,
    updatedBy: task.updatedBy ? (userMap.get(task.updatedBy) ?? null) : null,
    assignedTo,
    labels,
  };
};

/** Hydrate a list of tasks with user and label data using O(1) Map lookups. */
export const hydrateTasks = (tasks: TaskModel[], members: UserMinimalBaseSchemas[], labels: Labels[]): ReturnTask[] => {
  const userMap = new Map(members.map((m) => [m.id, m]));
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  return tasks.map((task) => mapTask(task, userMap, labelMap));
};

/** Hydrate a single task. Convenience wrapper around hydrateTasks. */
export const hydrateTask = (task: TaskModel, members: UserMinimalBaseSchemas[], labels: Labels[]): ReturnTask => {
  return hydrateTasks([task], members, labels)[0];
};

/** Fetch users and labels referenced by one or more tasks. */
export const getTaskRelations = async (ctx: AuthContext, { tasks }: { tasks: TaskModel[] }) => {
  const userIds = Array.from(
    new Set(tasks.flatMap((t) => [t.createdBy, t.updatedBy, ...t.assignedTo].filter((u) => u !== null))),
  );
  const labelIds = Array.from(new Set(tasks.flatMap((t) => t.labels)));
  return findTaskRelations(ctx, { userIds, labelIds });
};

/**
 * Lightweight task hydration that skips relation DB queries entirely.
 * Returns stub arrays for labels/assignedTo and builds updatedBy from the current user.
 */
export const hydrateTaskLite = (
  task: TaskModel,
  currentUser: Pick<UserMinimalBase, 'id' | 'name' | 'slug' | 'thumbnailUrl'>,
): ReturnTask => ({
  ...task,
  stx: task.stx,
  labels: [],
  assignedTo: [],
  createdBy: null,
  updatedBy: toUserMinimalBase(currentUser),
});
