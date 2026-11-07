import { toggleFilterValue } from '~/modules/task/helpers/search-filter';
import { boardFilterList, taskSheetParam } from '~/modules/task/search-params-schemas';
import { getRouter } from '~/routes/-router-instance';

/** Opens the task sheet through its search param, as a new history entry so back closes it. */
export const openTaskSheet = (taskId: string) => {
  getRouter().navigate({ to: '.', resetScroll: false, search: (prev) => ({ ...prev, [taskSheetParam]: taskId }) });
};

/** Selects the workspace board's project through `projectSlug`; without a slug the board falls back to its first project. */
export const selectBoardProject = (projectSlug?: string) => {
  getRouter().navigate({ to: '.', resetScroll: false, search: (prev) => ({ ...prev, projectSlug }) });
};

/** A label tile's filter toggle, written into the board search. */
export const toggleLabelFilter = (slug: string) => {
  getRouter().navigate({
    to: '.',
    replace: true,
    resetScroll: false,
    search: (prev) => ({ ...prev, labels: toggleFilterValue(boardFilterList.parse(prev.labels), slug) }),
  });
};

interface BoardFilterSearch {
  q?: string;
  labels?: unknown;
  status?: unknown;
  type?: unknown;
  assigned?: unknown;
}

/** Whether the board search is this label with exactly these statuses, and no words or other filter. */
export const isLabelStatusSearch = (search: BoardFilterSearch, slug: string, statuses: string[]) => {
  const labels = boardFilterList.parse(search.labels);
  const current = boardFilterList.parse(search.status);
  return (
    !search.q &&
    !boardFilterList.parse(search.type).length &&
    !boardFilterList.parse(search.assigned).length &&
    labels.length === 1 &&
    labels[0] === slug &&
    current.length === statuses.length &&
    statuses.every((status) => current.includes(status))
  );
};

/** An epic bar part: the board search becomes exactly this label and these statuses, so a press always shows the same tasks; a press on the search it already made clears it. */
export const replaceWithLabelStatusSearch = (slug: string, statuses: string[]) => {
  getRouter().navigate({
    to: '.',
    replace: true,
    resetScroll: false,
    search: (prev) => {
      const isCurrent = isLabelStatusSearch(prev, slug, statuses);
      return {
        ...prev,
        q: undefined,
        type: undefined,
        assigned: undefined,
        labels: isCurrent ? undefined : [slug],
        status: isCurrent ? undefined : statuses,
      };
    },
  });
};
