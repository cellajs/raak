import type { DropTargetRecord } from '@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types';
import type { GetTaskResponse } from 'sdk';
import type { z } from 'zod';
import type { EnrichedProject } from '~/modules/project/types';
import type { tasksTableSearchSchema } from '~/modules/task/search-params-schemas';
import type { statusOptions, TaskStatus } from '~/modules/task/task-properties';
import type { DraggableItemData } from '~/utils/get-draggable-item-data';

export type Task = GetTaskResponse & { _draft?: boolean };

/** The label shape embedded in a task, a subset of the full label. */
export type TaskLabel = NonNullable<Task['labels']>[number];

/** A board column: a project panel or a local panel (explainer, labels), told apart by `kind`. */
export type BoardResizablePanel =
  | {
      kind: 'project';
      project: EnrichedProject;
      panelId: string;
      /** The statuses it lists, in workflow order; all of them when absent. */
      statuses?: TaskStatus[];
      /** Added to the project's order, so a status panel never ties with the project's panel. */
      orderOffset?: number;
    }
  | { kind: 'explainer'; panelId: string }
  | { kind: 'labels'; panelId: string };

/** The project variant of a board panel (what `prepareBoardPanels` always produces). */
export type ProjectResizablePanel = Extract<BoardResizablePanel, { kind: 'project' }>;

export type TaskCounts = {
  total: number;
  /** Whether this panel folds accepted / iced into a section: not when it lacks them or lists nothing else. */
  showAccepted: boolean;
  showIced: boolean;
  /** Count of accepted / iced tasks in this panel (0 when the section isn't shown here). */
  accepted: number;
  iced: number;
  /** Total accepted tasks including those beyond the cutoff. 0 = no cutoff data available, or a panel without accepted tasks. */
  acceptedCutOff: number;
};

export type BoardSearchParams = z.infer<typeof tasksTableSearchSchema>;

export type TaskState = 'collapsed' | 'editing' | 'expanded';

export interface TaskProps {
  task: Task;
  state: TaskState;
  isSelected: boolean;
  isFocused: boolean;
  isSheet?: boolean;
  /** Sheet only: a click on the expanded card asks the sheet, which holds its own state, to start editing. */
  onEdit?: () => void;
}
export type TaskStatusType = (typeof statusOptions)[number]['value'];

export type DropTarget<T> = Omit<DropTargetRecord, 'data'> & { data: T };

export type TaskDraggableData = DraggableItemData<Task, 'task'>;
// Panels carry no per-drop order (unlike tasks), so displayOrder is absent from the drag payload.
export type PanelDraggableData = Omit<DraggableItemData<{ tasks: Task[]; projectId: string }, 'panel'>, 'displayOrder'> & { displayOrder?: number };
