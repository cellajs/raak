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

export type TaskCounts = {
  total: number;
  /** Whether this panel shows the accepted / iced section (false when section filters exclude it). */
  showAccepted: boolean;
  showIced: boolean;
  /** Count of accepted / iced tasks in this panel (0 when the section isn't shown here). */
  accepted: number;
  iced: number;
  /** Total accepted tasks including those beyond the cutoff. 0 = no cutoff data available. */
  acceptedCutOff: number;
};

export type TaskSearch = z.infer<typeof tasksTableSearchSchema>;

export type TaskState = 'collapsed' | 'editing' | 'expanded';

export interface TaskProps {
  task: Task & { isMatchingSearch?: boolean };
  state: TaskState;
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
// Panels carry no per-drop order (unlike tasks), so displayOrder is absent from the drag payload.
export type PanelDraggableData = Omit<
  DraggableItemData<{ tasks: Task[]; projectId: string }, 'panel'>,
  'displayOrder'
> & {
  displayOrder?: number;
};
