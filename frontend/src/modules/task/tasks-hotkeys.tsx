import { useSearch } from '@tanstack/react-router';
import type { Project } from 'sdk';
import { useHotkeys } from '~/hooks/use-hot-keys';
import type { HotkeyItem } from '~/hooks/use-hot-keys-helpers';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardFocusStore } from '~/modules/board-focus/board-focus-store';
import { BoardNavHotkeys } from '~/modules/board-focus/board-nav-hotkeys';
import { focusItem } from '~/modules/board-focus/focus-item';
import { findItemPanelId, getPanelNav } from '~/modules/board-focus/panel-nav-registry';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { boardSearchInputId } from '~/modules/task/board-search';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import type { DropdownsType } from '~/modules/task/dropdowns/types';
import { currentActiveTask } from '~/modules/task/helpers/active-task';
import { closeCreateTaskForm, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { buildFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { useCurrentUser } from '~/modules/user/user-store';
import { isHoverContentOpen } from '~/utils/is-hover-content-open';

interface TasksHotkeysProps {
  projects: Project[];
}

/** Registers task actions for task views, and the board's arrow-key navigation while no task sheet is open. */
export function TasksHotkeys({ projects }: TasksHotkeysProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const user = useCurrentUser();
  const taskMutation = useTaskUpdateMutation(tenantId, organizationId);

  const taskSheetId = useSearch({ strict: false, select: (search) => search.taskSheetId });
  const isSheetOpen = !!taskSheetId;

  const currentDraft = () => {
    const { currentItemId } = useBoardFocusStore.getState();
    return Object.values(useTaskInteractionStore.getState().draftTasks).find((draft) => draft.id === currentItemId);
  };

  const handleEscKeyPress = () => {
    // The Escape that closes a tooltip or hover card stops there: the card and its sheet keep their state (WCAG 1.4.13).
    if (isHoverContentOpen()) return;

    // On the create form itself (Escape in its editor first steps out to it): close the form, its values kept as a
    // draft, and move to its neighbour in the list
    const draft = currentDraft();
    if (draft) {
      if (document.activeElement?.id !== draft.id) return;
      const panelId = findItemPanelId(draft.id);
      const items = (panelId && getPanelNav(panelId)?.items()) || [];
      const index = items.findIndex(({ id }) => id === draft.id);
      const neighbour = index === -1 ? undefined : (items[index - 1] ?? items[index + 1]);
      closeCreateTaskForm(draft.projectId);
      if (neighbour) focusItem(neighbour.id);
      return;
    }

    const task = currentActiveTask(taskSheetId);
    if (!task) return;

    if (document.activeElement instanceof HTMLElement && task.id === document.activeElement.id) {
      document.activeElement.blur();
    }

    if (isSheetOpen) return useSheeter.getState().remove(`taskSheetId-${task.id}`);

    const taskCard = document.getElementById(task.id);
    const state = taskCard?.dataset.state;
    if (state === 'collapsed') return;
    return useTaskCardStore.getState().setTaskState(task.id, state === 'editing' ? 'expanded' : 'collapsed');
  };

  const handleEnterKeyPress = () => {
    const task = currentActiveTask(taskSheetId);
    if (!task) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${task.id}` : task.id);
    const currentState = taskCard?.dataset.state ?? 'collapsed';
    if (isProjectReadOnly(task.projectId) && currentState === 'expanded') return;
    useTaskCardStore.getState().setTaskState(task.id, currentState === 'collapsed' ? 'expanded' : 'editing');
  };

  const handleNKeyDown = () => {
    if (!projects.length) return;
    const { draftTasks } = useTaskInteractionStore.getState();
    const openDraftProjectId = Object.keys(draftTasks)[0];

    let targetProjectId: string | undefined = openDraftProjectId;
    if (!targetProjectId) targetProjectId = currentActiveTask(taskSheetId)?.projectId;

    const targetProject = projects.find((p) => p.id === targetProjectId) ?? projects[0];
    if (isProjectReadOnly(targetProject.id)) return;
    toggleCreateTaskForm(targetProject);
  };

  // Open a field dropdown for the focused task
  const hotKeyPress = (field: DropdownsType) => {
    const targetTask = currentActiveTask(taskSheetId);
    if (!targetTask) return;

    if (isProjectReadOnly(targetTask.projectId)) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${targetTask.id}` : targetTask.id);
    if (!taskCard) return;
    if (document.activeElement !== taskCard) taskCard.focus();

    const triggerId = `${field}-${targetTask.id}${isSheetOpen ? '-sheet' : ''}`;
    const trigger = taskCard.querySelector(`#${triggerId}`);
    if (!(trigger instanceof HTMLButtonElement)) return useDropdowner.getState().remove();

    const handlers = buildFieldHandlers(targetTask, { taskMutation, user });
    const base = { triggerId, triggerRef: { current: trigger }, taskId: targetTask.id };

    // The switch keeps each call matched to its discriminated-union member without a cast.
    switch (field) {
      case 'labels':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'labels',
          value: targetTask.labels,
          projectId: targetTask.projectId,
          onChange: handlers.onLabelsChange,
        });
      case 'assignedTo':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'assignedTo',
          value: targetTask.assignedTo,
          projectId: targetTask.projectId,
          onChange: handlers.onAssignedToChange,
        });
      case 'status':
        return handleTaskDropdownClick({ ...base, dropdownType: 'status', value: targetTask.status, onChange: handlers.onStatusChange });
      case 'primaryLabel':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'primaryLabel',
          value: targetTask.primaryLabelId,
          projectId: targetTask.projectId,
          onChange: handlers.onPrimaryLabelChange,
        });
    }
  };

  // A letter alone fires by accident under speech input (WCAG 2.1.4); Alt + A is the account sheet, so assignee is U
  const actionHotkeys: HotkeyItem[] = [
    ['Alt + U', () => hotKeyPress('assignedTo')],
    ['Alt + L', () => hotKeyPress('labels')],
    ['Alt + S', () => hotKeyPress('status')],
    ['Alt + T', () => hotKeyPress('primaryLabel')],
    ['Alt + N', handleNKeyDown],
  ];

  // Browser find cannot see virtualized cards: the first press lands in the search box, and a second press typed there is native find.
  const handleFindKeyDown = (event: KeyboardEvent) => {
    const input = document.getElementById(boardSearchInputId);
    if (!(input instanceof HTMLInputElement)) return;
    event.preventDefault();
    input.focus();
    input.select();
  };

  const stateHotkeys: HotkeyItem[] = [
    ['Escape', handleEscKeyPress],
    ['Enter', handleEnterKeyPress],
    ['meta + f', handleFindKeyDown, { preventDefault: false }],
    ['ctrl + f', handleFindKeyDown, { preventDefault: false }],
  ];

  const gridIgnoreTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', '[role="grid"]'];

  const coreHotkeys = [...stateHotkeys, ...actionHotkeys];
  useHotkeys(coreHotkeys, gridIgnoreTags);

  return <BoardNavHotkeys disabled={isSheetOpen} />;
}
