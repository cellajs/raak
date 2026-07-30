import { zCreateTasksBody, zLabel, zTask, zUserMinimalBase } from 'sdk/zod.gen';
import { z } from 'zod';
import { blocknoteFieldIsDirty } from '~/modules/common/blocknote/helpers/blocknote-field-is-dirty';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { makePanelKey, resolveDraftHostSection } from '~/modules/task/helpers/board-helpers';
import { focusTask, focusWhenMounted } from '~/modules/task/helpers/focus-task';
import { getDraftDisplayOrder } from '~/modules/task/helpers/order-helpers';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { getSchemaDefaults } from '~/query/basic/create-optimistic';

/** Expands the panel (and accepted/iced section) that will host the create-task form. */
export const revealDraftHostPanel = (projectId: string, draftStatus: TaskStatus) => {
  const boardId = useBoardStore.getState().activeBoardId;
  if (!boardId) return;

  const viewSections = useTaskBoardStore.getState().panelData[boardId]?.[projectId]?.viewSections;
  const hostSection = resolveDraftHostSection(viewSections, draftStatus);
  const panelId = hostSection ? makePanelKey(projectId, hostSection) : projectId;
  useBoardStore.getState().togglePanelCollapsedState(panelId, false);

  const { togglePanelSectionExpandState } = useTaskBoardStore.getState();
  if (draftStatus === TaskStatus.Accepted) togglePanelSectionExpandState(boardId, projectId, 'accepted', true);
  if (draftStatus === TaskStatus.Iced) togglePanelSectionExpandState(boardId, projectId, 'iced', true);
};

/** Validates create-task form values. */
export const createTaskFormSchema = z.object({
  ...zCreateTasksBody.element.omit({ stx: true }).shape,
  status: z.enum(TaskStatus),
  // Empty until the form resolves the project's default primary label (first by displayOrder)
  primaryLabelId: z.string(),
  assignedTo: z.array(zUserMinimalBase),
  labels: z.array(zLabel),
});

export type NewTaskFormValues = z.infer<typeof createTaskFormSchema>;

// Derive defaults from schema, override only intentional UX choices
/** Builds the default values for a new-task form. */
export const newTaskFormDefaults: NewTaskFormValues = {
  ...getSchemaDefaults(createTaskFormSchema),
  status: TaskStatus.Unstarted,
};

/** Checks whether a new-task form contains unsaved values. */
export const newTaskFormIsDirty = ({
  assignedTo,
  labels,
  description,
}: Pick<NewTaskFormValues, 'assignedTo' | 'labels' | 'description'>) =>
  assignedTo.length > 0 || labels.length > 0 || (!!description && blocknoteFieldIsDirty(description));

// Handles logic for showing or hiding task creation form via Zustand draft state
/** Toggles create task form. */
export const toggleCreateTaskForm = (project: { id: string; organizationId: string; tenantId: string }) => {
  const id = `create-task-${project.id}`;
  const store = useTaskInteractionStore.getState();
  const existingDraft = store.draftTasks[project.id];

  // Toggle: if draft already exists, remove it (form open-ness is derived from the draft)
  if (existingDraft) {
    focusTask(null);
    store.setDraftTask(project.id, null);
    return;
  }

  // Retrieve draft form data
  const draftForm = useDraftStore.getState().getForm<NewTaskFormValues | undefined>(id);
  const draftStatus = draftForm?.status || TaskStatus.Unstarted;

  // Base structure for a draft task with schema defaults and draft-specific overrides.
  const defaultTask: Task = {
    ...getSchemaDefaults(zTask),
    id,
    status: draftStatus,
    displayOrder: getDraftDisplayOrder(draftStatus, project.id),
    projectId: project.id,
    organizationId: project.organizationId,
    _draft: true,
  };

  // Merge form values over default structure, retaining order & id
  const formTask: Task = {
    ...defaultTask,
    ...draftForm,
    id: defaultTask.id,
    displayOrder: defaultTask.displayOrder,
  };

  // ProjectBoardPanel merges this draft into the task list.
  focusTask(id);
  store.setDraftTask(project.id, formTask);
  revealDraftHostPanel(project.id, formTask.status);

  // Focus the form element and trigger glow after React renders
  focusWhenMounted(id);
  setTimeout(() => triggerTaskGlow(id), 100);
};
