import { useSearch } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import type { EnrichedProject } from '~/modules/project/types';
import { defaultPanelPrefs, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { pickViewSections, prepareBoardPanels, renderedPanelTasks } from '~/modules/task/helpers/board-helpers';
import { subscribeToTaskCache } from '~/modules/task/hooks/use-tasks-total';

/** Ids of the tasks the board search matches, panel by panel in render order; empty without a query. */
export const useMatchingTaskIds = (boardId: string, projects: EnrichedProject[]): string[] => {
  const q = useSearch({ strict: false, select: (search) => search.q });
  const matchMode = useSearch({ strict: false, select: (search) => search.matchMode });
  const panelData = useTaskBoardStore((state) => state.panelData[boardId]);

  // Joined into one string: useSyncExternalStore compares snapshots by value.
  const joined = useSyncExternalStore(subscribeToTaskCache, () => {
    if (!parseSearchQuery(q).terms.length) return '';
    const tasks = cachedTasks();
    return prepareBoardPanels(projects, pickViewSections(panelData))
      .flatMap((panel) => renderedPanelTasks(panel, tasks, { q, matchMode }, panelData?.[panel.project.id]?.prefs ?? defaultPanelPrefs))
      .map(({ id }) => id)
      .join('\n');
  });

  return joined ? joined.split('\n') : [];
};
