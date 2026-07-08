import { zGetTasksQuery } from 'sdk/zod.gen';
import z from 'zod';

const taskViewSchema = z.enum(['board', 'table']).default('board').catch('board');

const baseTaskViewSchema = z.object({
  taskSheetId: z.string().optional(),
  userSheetId: z.string().optional(),
  view: taskViewSchema.optional(),
});

// Search schemas, some are also used in project routes
export const tasksTableSearchSchema = zGetTasksQuery
  .pick({ q: true, sort: true, order: true, matchMode: true })
  .extend({ ...baseTaskViewSchema.shape });

export const tasksBoardSearchSchema = zGetTasksQuery.pick({ q: true, matchMode: true }).extend({
  projectSlug: z.string().optional(),
  ...baseTaskViewSchema.shape,
});

export const combinedTaskSearchSchema = z.object({ ...tasksBoardSearchSchema.shape, ...tasksTableSearchSchema.shape });
