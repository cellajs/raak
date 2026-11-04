import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useHotkeys } from '~/hooks/use-hotkeys';
import type { HotkeyItem } from '~/hooks/use-hotkeys-helpers';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { announce } from '~/modules/common/announce';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { BoardNavHotkeys } from '~/modules/task/board/board-nav-hotkeys';
import { boardSearchInputId } from '~/modules/task/board-search';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import type { TaskDropdownType } from '~/modules/task/dropdowns/types';
import { currentActiveTask } from '~/modules/task/helpers/active-task';
import { closeCreateTaskForm, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { openTaskFieldDropdown, taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { findItemPanelId, getPanelNav } from '~/modules/task/helpers/panel-nav-registry';
import { buildFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import { taskSheetParam } from '~/modules/task/search-params-schemas';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { useCurrentUser } from '~/modules/user/user-store';
import { isHoverContentOpen } from '~/utils/is-hover-content-open';

const gridIgnoreTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', '[role="grid"]'];

// Browser find cannot see virtualized cards or rows: the first press goes to the search box, and a second press typed there is native find.
// Registered apart from gridIgnoreTags, so it also works from a table cell or a button.
const handleFind = (event: KeyboardEvent) => {
  const input = document.getElementById(boardSearchInputId);
  if (!(input instanceof HTMLInputElement)) return;
  event.preventDefault();
  input.focus();
  input.select();
};

const findHotkeys: HotkeyItem[] = [
  ['meta + f', handleFind, { preventDefault: false }],
  ['ctrl + f', handleFind, { preventDefault: false }],
];

interface TasksHotkeysProps {
  projects: Project[];
}

/** Registers task actions for task views, and the board's arrow-key navigation while no task sheet is open. */
export function TasksHotkeys({ projects }: TasksHotkeysProps) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const user = useCurrentUser();
  const taskMutation = useTaskUpdateMutation(tenantId, organizationId);

  const taskSheetId = useSearch({ strict: false, select: (search) => search.taskSheetId });
  const isSheetOpen = !!taskSheetId;

  const currentDraft = () => {
    const { currentItemId } = useBoardFocusStore.getState();
    return Object.values(taskInteractionStore.getState().draftTasks).find((draft) => draft.id === currentItemId);
  };

  // useHotkeys prevents every Escape it matches, so the selection bar never sees one: an Escape no task takes clears it here
  const clearSelection = () => {
    const { selectedTaskIds, setSelectedTaskIds } = taskInteractionStore.getState();
    if (!selectedTaskIds.length) return;
    setSelectedTaskIds([]);
    announce(document.body, t('c:success.clear_selection'));
  };

  const handleEscape = () => {
    // The Escape that closes a tooltip or hover card stops there: the card and its sheet keep their state (WCAG 1.4.13).
    if (isHoverContentOpen()) return;

    // On the create form (Escape in its editor first steps out to it): close it, keeping a draft, and focus its neighbour
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
    if (!task) return clearSelection();

    if (isSheetOpen) return sheeter.getState().remove(`${taskSheetParam}-${task.id}`);

    const taskCard = document.getElementById(task.id);
    const state = taskCard?.dataset.state;
    if (state === 'collapsed') return clearSelection();
    return taskCardStore.getState().setTaskState(task.id, state === 'editing' ? 'expanded' : 'collapsed');
  };

  const handleEnter = () => {
    const task = currentActiveTask(taskSheetId);
    if (!task) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${task.id}` : task.id);
    const currentState = taskCard?.dataset.state ?? 'collapsed';
    if (isProjectReadOnly(task.projectId) && currentState === 'expanded') return;
    taskCardStore.getState().setTaskState(task.id, currentState === 'collapsed' ? 'expanded' : 'editing');
  };

  const handleNewTask = () => {
    if (!projects.length) return;
    const { draftTasks } = taskInteractionStore.getState();
    const openDraftProjectId = Object.keys(draftTasks)[0];

    const targetProjectId = openDraftProjectId || currentActiveTask(taskSheetId)?.projectId;

    const targetProject = projects.find((project) => project.id === targetProjectId) ?? projects[0];
    if (isProjectReadOnly(targetProject.id)) return;
    toggleCreateTaskForm(targetProject);
  };

  const openFieldDropdown = (field: TaskDropdownType) => {
    const targetTask = currentActiveTask(taskSheetId);
    if (!targetTask) return;

    if (isProjectReadOnly(targetTask.projectId)) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${targetTask.id}` : targetTask.id);
    if (!taskCard) return;
    if (document.activeElement !== taskCard) taskCard.focus();

    const trigger = taskCard.querySelector(`#${taskFieldTriggerId(field, targetTask.id, isSheetOpen)}`);
    if (!(trigger instanceof HTMLButtonElement)) return dropdowner.getState().remove();

    openTaskFieldDropdown(targetTask, field, buildFieldHandlers(targetTask, { taskMutation, user }), trigger);
  };

  // A letter alone fires by accident under speech input (WCAG 2.1.4); Alt + A is the account sheet, so assignee is U
  const actionHotkeys: HotkeyItem[] = [
    ['Alt + U', () => openFieldDropdown('assignedTo')],
    ['Alt + L', () => openFieldDropdown('labels')],
    ['Alt + S', () => openFieldDropdown('status')],
    ['Alt + T', () => openFieldDropdown('primaryLabel')],
    ['Alt + N', handleNewTask],
  ];

  const stateHotkeys: HotkeyItem[] = [
    ['Escape', handleEscape],
    ['Enter', handleEnter],
  ];

  const coreHotkeys = [...stateHotkeys, ...actionHotkeys];
  useHotkeys(coreHotkeys, gridIgnoreTags);
  useHotkeys(findHotkeys);

  return <BoardNavHotkeys disabled={isSheetOpen} />;
}

/** The board keys of a public page, which only shows tasks: Enter opens the current card, Escape closes it, the arrows move between cards. */
export function PublicTasksHotkeys() {
  const taskSheetId = useSearch({ strict: false, select: (search) => search.taskSheetId });

  // Public tasks sit in a cache of their own, which currentActiveTask does not read: the card element holds all these keys need
  const currentCard = () => {
    const { currentItemId } = useBoardFocusStore.getState();
    const card = currentItemId ? document.getElementById(currentItemId) : null;
    return card?.hasAttribute('data-task-card-id') ? card : null;
  };

  const handleEnter = () => {
    const card = taskSheetId ? null : currentCard();
    if (card?.dataset.state === 'collapsed') taskCardStore.getState().setTaskState(card.id, 'expanded');
  };

  const handleEscape = () => {
    if (isHoverContentOpen()) return;
    if (taskSheetId) return sheeter.getState().remove(`${taskSheetParam}-${taskSheetId}`);
    const card = currentCard();
    if (card && card.dataset.state !== 'collapsed') taskCardStore.getState().setTaskState(card.id, 'collapsed');
  };

  useHotkeys(
    [
      ['Escape', handleEscape],
      ['Enter', handleEnter],
    ],
    gridIgnoreTags,
  );
  useHotkeys(findHotkeys);

  return <BoardNavHotkeys disabled={!!taskSheetId} />;
}
