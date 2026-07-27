import { zGetTasksQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { labelPanelSearchSchema } from '~/modules/label/search-params-schemas';

const taskViewSchema = z.enum(['board', 'table']).default('board').catch('board');

/**
 * Default board view state. Single source for URL stripping (route search middleware) and query
 * fallbacks. Mirrors the defaults in `zGetTasksQuery` plus the `view` default.
 */
export const boardSearchDefaults = { q: '', view: 'board', sort: 'createdAt', order: 'asc', matchMode: 'all' } as const;

const baseTaskViewSchema = z.object({
  taskSheetId: z.string().optional(),
  userSheetId: z.string().optional(),
  view: taskViewSchema.optional(),
  ...labelPanelSearchSchema.shape,
});

// Search schemas, some are also used in project routes
export const tasksTableSearchSchema = zGetTasksQuery
  .pick({ q: true, sort: true, order: true, matchMode: true })
  .extend({ ...baseTaskViewSchema.shape });

export const tasksBoardSearchSchema = zGetTasksQuery.pick({ q: true, matchMode: true }).extend({
  projectSlug: z.string().optional(),
  ...baseTaskViewSchema.shape,
});

export const boardSearchSchema = z.object({ ...tasksBoardSearchSchema.shape, ...tasksTableSearchSchema.shape });
