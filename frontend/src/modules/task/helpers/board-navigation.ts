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

/** A label tile's status segment: puts the label and the status in the board search, or takes the status out when both are in. */
export const toggleLabelStatusFilter = (slug: string, status: string) => {
  getRouter().navigate({
    to: '.',
    replace: true,
    resetScroll: false,
    search: (prev) => {
      const labels = boardFilterList.parse(prev.labels);
      const statuses = boardFilterList.parse(prev.status);
      if (labels.includes(slug) && statuses.includes(status)) return { ...prev, status: statuses.filter((other) => other !== status) };
      return {
        ...prev,
        labels: labels.includes(slug) ? labels : [...labels, slug],
        status: statuses.includes(status) ? statuses : [...statuses, status],
      };
    },
  });
};
