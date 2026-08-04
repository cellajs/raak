import { zGetTasksQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { labelPanelSearchSchema } from '~/modules/label/search-params-schemas';

const taskViewSchema = z.enum(['board', 'table']).default('board').catch('board');

/**
 * Default board view state. Single source for URL stripping (route search middleware) and query
 * fallbacks. `order` is `desc` so the table opens newest-first; the board ignores order (its panels
 * sort by displayOrder), so this only shapes the table view.
 */
export const boardSearchDefaults = {
  q: '',
  view: 'board',
  sort: 'createdAt',
  order: 'desc',
  matchMode: 'all',
} as const;

const baseTaskViewSchema = z.object({
  taskSheetId: z.string().optional(),
  userSheetId: z.string().optional(),
  view: taskViewSchema.optional(),
  ...labelPanelSearchSchema.shape,
});

// Search schemas, some are also used in project routes
/** Validates URL search parameters for tasks table. */
export const tasksTableSearchSchema = zGetTasksQuery
  .pick({ q: true, sort: true, order: true, matchMode: true })
  .extend({
    ...baseTaskViewSchema.shape,
    // Newest-first by default (the API default is ascending); matches `boardSearchDefaults.order`.
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  });

/** Validates URL search parameters for tasks board. */
export const tasksBoardSearchSchema = zGetTasksQuery.pick({ q: true, matchMode: true }).extend({
  projectSlug: z.string().optional(),
  ...baseTaskViewSchema.shape,
});

/** Validates URL search parameters for board. */
export const boardSearchSchema = z.object({
  ...tasksBoardSearchSchema.shape,
  ...tasksTableSearchSchema.shape,
  // URL-driven settings sheets on board surfaces (deep-linkable, survive refresh)
  projectSettingsId: z.string().optional(),
  workspaceSettingsId: z.string().optional(),
});
