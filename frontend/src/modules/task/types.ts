import type { DropTargetRecord } from '@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types';
import type { GetTaskResponse } from 'sdk';
import type { z } from 'zod';
import type { EnrichedProject } from '~/modules/project/types';
import type { SectionsValue } from '~/modules/task/board/task-board-store';
import type { tasksTableSearchSchema } from '~/modules/task/search-params-schemas';
import type { statusOptions } from '~/modules/task/task-properties';
import type { DraggableItemData } from '~/utils/get-draggable-item-data';

export type Task = GetTaskResponse & { _draft?: boolean };

/** Embedded label shape as it appears on a task (subset of full Label). */
export type TaskLabel = NonNullable<Task['labels']>[number];

/** Stable id for the explainer ("getting started") panel. Also a persisted board-layout /
 *  collapse-state key, so this string value must not change. */
export const EXPLAINER_PANEL_ID = 'explainer';

/** A board column: either a project panel (optionally a section-filtered split of one) or a
 *  local, non-project panel (currently just the explainer). The `kind` discriminant replaces
 *  the old "any panel without a project is the explainer" heuristic. */
export type BoardResizablePanel =
  | { kind: 'project'; project: EnrichedProject; sectionFilters?: SectionsValue; panelId: string }
  | { kind: 'explainer'; panelId: string };

/** The project variant of a board panel (what `prepareBoardPanels` always produces). */
export type ProjectResizablePanel = Extract<BoardResizablePanel, { kind: 'project' }>;

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
export type TaskStatusType = (typeof statusOptions)[number]['value'];

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
