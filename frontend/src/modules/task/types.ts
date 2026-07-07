import type { DropTargetRecord } from '@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types';
import type { GetTaskResponse } from 'sdk';
import type { z } from 'zod';
import type { EnrichedProject } from '~/modules/project/types';
import type { SectionsValue } from '~/modules/task/board/task-board-store';
import type { tasksTableSearchSchema } from '~/modules/task/search-params-schemas';
import type { statusOptions, variantOptions } from '~/modules/task/task-properties';
import type { DraggableItemData } from '~/utils/get-draggable-item-data';

export type Task = GetTaskResponse & { _draft?: boolean };

/** Embedded label shape as it appears on a task (subset of full Label). */
export type TaskLabel = NonNullable<Task['labels']>[number];

export type BoardResizablePanel = { project?: EnrichedProject; sectionFilters?: SectionsValue; panelId: string };

/** Check whether a task object is a virtual draft (inline create-form placeholder). */
export const isDraftTask = (task: { _draft?: boolean }): boolean => '_draft' in task && task._draft === true;

export type TaskCounts = {
  total: number;
  iced?: number;
  accepted?: number;
  /** Total accepted tasks including those beyond the cutoff. 0 = no cutoff data available. */
  acceptedCutOff: number;
};

export type TaskSearch = z.infer<typeof tasksTableSearchSchema>;

export type TaskStates = 'collapsed' | 'editing' | 'expanded';

export interface TaskProps {
  task: Task & { isMatchingSearch?: boolean };
  state: TaskStates;
  isSelected: boolean;
  isFocused: boolean;
  isSheet?: boolean;
}
/**
 * Selectable points values. `Task['points']` stays `number | null` (the backend contract is a
 * full int), so this is the set the UI offers, not a guarantee about stored values.
 */
export type TaskPointsType = 0 | 1 | 2 | 3 | null;
export type TaskStatusType = (typeof statusOptions)[number]['value'];
export type TaskVariantType = (typeof variantOptions)[number]['value'];

export type DropTarget<T> = Omit<DropTargetRecord, 'data'> & {
  data: T;
};

export type TaskDraggableData = DraggableItemData<Task, 'task'>;
export type PanelDraggableData = DraggableItemData<{ tasks: Task[]; projectId: string }, 'panel'>;
