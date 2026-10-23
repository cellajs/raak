import { zCreateTasksBody, zLabel, zTask, zUserMinimalBase } from 'sdk/zod.gen';
import { z } from 'zod';
import { focusWhenMounted, setCurrentItem } from '~/modules/board-focus/focus-item';
import { blocknoteFieldIsDirty } from '~/modules/common/blocknote/helpers/blocknote-field-is-dirty';
import { boardStore } from '~/modules/common/board/board-store';
import { draftStore } from '~/modules/common/form-draft/draft-store';
import { taskBoardStore } from '~/modules/task/board/task-board-store';
import { makePanelKey, resolveDraftHostSection } from '~/modules/task/helpers/board-helpers';
import { getDraftDisplayOrder } from '~/modules/task/helpers/order-helpers';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { getSchemaDefaults } from '~/query/basic/create-optimistic';

/** Expands the panel (and accepted/iced section) that will host the create-task form. */
export const revealDraftHostPanel = (projectId: string, draftStatus: TaskStatus) => {
  const boardId = boardStore.getState().activeBoardId;
  if (!boardId) return;

  const viewSections = taskBoardStore.getState().panelData[boardId]?.[projectId]?.viewSections;
  const hostSection = resolveDraftHostSection(viewSections, draftStatus);
  const panelId = hostSection ? makePanelKey(projectId, hostSection) : projectId;
  boardStore.getState().togglePanelCollapsedState(panelId, false);

  const { setPanelSectionExpanded } = taskBoardStore.getState();
  if (draftStatus === TaskStatus.Accepted) setPanelSectionExpanded(boardId, projectId, 'accepted', true);
  if (draftStatus === TaskStatus.Iced) setPanelSectionExpanded(boardId, projectId, 'iced', true);
};

export const createTaskFormSchema = z.object({
  ...zCreateTasksBody.element.omit({ stx: true }).shape,
  status: z.enum(TaskStatus),
  // Empty until the form resolves the project's default primary label
  primaryLabelId: z.string(),
  assignedTo: z.array(zUserMinimalBase),
  labels: z.array(zLabel),
});

export type NewTaskFormValues = z.infer<typeof createTaskFormSchema>;

export const newTaskFormDefaults: NewTaskFormValues = { ...getSchemaDefaults(createTaskFormSchema), status: TaskStatus.Unstarted };

export const newTaskFormIsDirty = ({ assignedTo, labels, description }: Pick<NewTaskFormValues, 'assignedTo' | 'labels' | 'description'>) =>
  assignedTo.length > 0 || labels.length > 0 || (!!description && blocknoteFieldIsDirty(description));

/** The create-task form's element id; card-glow.css styles ids starting with `create-task-`. */
export const createTaskFormId = (projectId: string) => `create-task-${projectId}`;

/** Closes a project's create-task form; unlike the toggle, a repeated or late call never reopens it. */
export const closeCreateTaskForm = (projectId: string) => {
  setCurrentItem(null);
  taskInteractionStore.getState().setDraftTask(projectId, null);
};

/** Opens a project's create-task form, or closes it when open; its open-ness is derived from the draft. */
export const toggleCreateTaskForm = (project: { id: string; organizationId: string; tenantId: string }) => {
  const id = createTaskFormId(project.id);
  const store = taskInteractionStore.getState();

  if (store.draftTasks[project.id]) return closeCreateTaskForm(project.id);

  const draftForm = draftStore.getState().getForm<NewTaskFormValues | undefined>(id);
  const draftStatus = draftForm?.status ?? TaskStatus.Unstarted;

  const defaultTask: Task = {
    ...getSchemaDefaults(zTask),
    id,
    status: draftStatus,
    displayOrder: getDraftDisplayOrder(draftStatus, project.id),
    projectId: project.id,
    organizationId: project.organizationId,
    _draft: true,
  };

  const formTask: Task = { ...defaultTask, ...draftForm, id: defaultTask.id, displayOrder: defaultTask.displayOrder };

  // ProjectBoardPanel merges the draft into the task list.
  setCurrentItem(id);
  store.setDraftTask(project.id, formTask);
  revealDraftHostPanel(project.id, formTask.status);

  // The form mounts after React renders the draft
  focusWhenMounted(id);
  setTimeout(() => triggerTaskGlow(id), 100);
};
