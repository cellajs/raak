import { zGetTasksQuery } from 'sdk/zod.gen';
import { z } from 'zod';

/**
 * Default list view state — the single source for URL stripping (route search middleware) and for
 * the query fallbacks in `query.ts`/`public-query.ts`, which sheets and grids hit with no zod
 * defaults at all (`useSearchParams({ saveDataInSearch: false })` returns `{}`).
 *
 * `view` is deliberately absent: it is `ZodOptional<ZodDefault>`, so absence already short-circuits
 * to undefined and it is never injected into the URL. `projectSlug` and the sheet ids are real
 * filters, not defaults.
 */
export const tasksSearchDefaults = { q: '', sort: 'createdAt', order: 'desc', matchMode: 'all' } as const;

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
