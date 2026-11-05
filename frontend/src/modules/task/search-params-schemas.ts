import { zGetTasksQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { csvSearchParam } from '~/modules/common/search-params-schemas';
import { labelPanelSearchSchema } from '~/modules/label/search-params-schemas';

const taskViewSchema = z.enum(['board', 'table']).default('board').catch('board');

/** Single source for URL stripping and query fallbacks. `order` is desc so the table opens newest-first; board panels sort by displayOrder. */
export const boardSearchDefaults = { q: '', view: 'board', sort: 'createdAt', order: 'desc' } as const;

/** Search param holding the open task's id. Its presence is the sheet's open state. */
export const taskSheetParam = 'taskSheetId';

/** One board filter's values, from the comma-separated key in the URL or an array a navigate passes. */
export const boardFilterList = csvSearchParam(z.string().min(1));

const boardFiltersSchema = z.object({ status: boardFilterList, type: boardFilterList, labels: boardFilterList, assigned: boardFilterList });

const baseTaskViewSchema = z.object({
  [taskSheetParam]: z.string().optional(),
  userSheetId: z.string().optional(),
  // Attachments are project-homed, so their notification links resolve here; the globally mounted
  // dialog handler only sees params the route validates.
  attachmentDialogId: z.string().optional(),
  groupId: z.string().optional(),
  view: taskViewSchema.optional(),
  ...labelPanelSearchSchema.shape,
});

export const tasksTableSearchSchema = zGetTasksQuery.pick({ q: true, sort: true, order: true }).extend({
  ...boardFiltersSchema.shape,
  ...baseTaskViewSchema.shape,
  // Newest-first by default (the API default is ascending); matches `boardSearchDefaults.order`.
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

const tasksBoardSearchSchema = zGetTasksQuery
  .pick({ q: true })
  .extend({ projectSlug: z.string().optional(), statusTab: z.string().optional(), ...boardFiltersSchema.shape, ...baseTaskViewSchema.shape });

export const boardSearchSchema = z.object({ ...tasksBoardSearchSchema.shape, ...tasksTableSearchSchema.shape });
