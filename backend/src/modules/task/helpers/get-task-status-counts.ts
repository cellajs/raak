import type { DbContext } from '#/core/context';
import { TaskStatus } from '#/modules/task/task-properties';
import { countTasksByStatus } from '#/modules/task/task-queries';

type TaskStatusCounts = Record<Lowercase<keyof typeof TaskStatus>, number>;

const statusNames = Object.entries(TaskStatus)
  .filter(([key]) => Number.isNaN(Number(key)))
  .map(([name, value]) => ({ name: name.toLowerCase(), value: value as number }));

/**
 * Get task counts grouped by status for a single project.
 * Used in getProject (single entity) handler.
 */
export const getTaskStatusCounts = async (ctx: DbContext, projectId: string): Promise<TaskStatusCounts> => {
  const rows = await countTasksByStatus(ctx, projectId);

  // Build object with all statuses defaulting to 0
  const result: Record<string, number> = {};
  for (const { name } of statusNames) result[name] = 0;
  for (const row of rows) {
    const entry = statusNames.find((s) => s.value === row.status);
    if (entry) result[entry.name] = row.count;
  }

  return result as TaskStatusCounts;
};
