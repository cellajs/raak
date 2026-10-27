import { useSearch } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import type { EnrichedProject } from '~/modules/project/types';
import { defaultPanelPrefs, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { cachedPublicTasks, cachedTasks, subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { pickViewSections, prepareBoardPanels, renderedPanelTasks } from '~/modules/task/helpers/board-helpers';

/** Ids of the tasks the board search matches, panel by panel in render order; empty without a query. */
export function useMatchingTaskIds(boardId: string, projects: EnrichedProject[], publicView?: boolean): string[] {
  const q = useSearch({ strict: false, select: (search) => search.q });
  const matchMode = useSearch({ strict: false, select: (search) => search.matchMode });
  const panelData = useTaskBoardStore((state) => state.panelData[boardId]);

  // Joined into one string: useSyncExternalStore compares snapshots by value.
  const joined = useSyncExternalStore(subscribeToTaskCache, () => {
    const { terms, excludeTerms } = parseSearchQuery(q);
    if (!terms.length && !excludeTerms.length) return '';
    const tasks = publicView ? cachedPublicTasks() : cachedTasks();
    return prepareBoardPanels(projects, pickViewSections(panelData))
      .flatMap((panel) => renderedPanelTasks(panel, tasks, { q, matchMode }, panelData?.[panel.project.id]?.prefs ?? defaultPanelPrefs))
      .map(({ id }) => id)
      .join('\n');
  });

  return joined ? joined.split('\n') : [];
}
