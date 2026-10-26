import { type LabelAction, toggleLabelSearch } from '~/modules/label/label-search';
import { taskSheetParam } from '~/modules/task/search-params-schemas';
import { getRouter } from '~/routes/-router-instance';

/** Opens the task sheet through its search param, as a new history entry so back closes it. */
export const openTaskSheet = (taskId: string) => {
  getRouter().navigate({ to: '.', resetScroll: false, search: (prev) => ({ ...prev, [taskSheetParam]: taskId }) });
};

/** Selects the workspace board's project through `projectSlug`; without a slug the board falls back to its first project. */
export const selectBoardProject = (projectSlug?: string) => {
  getRouter().navigate({ to: '.', resetScroll: false, search: (prev) => ({ ...prev, projectSlug }) });
};

/** A label tile's filter, highlight or exclude toggle, written into the board search. */
export const applyLabelAction = (name: string, action: LabelAction) => {
  getRouter().navigate({
    to: '.',
    replace: true,
    resetScroll: false,
    search: (prev) => ({ ...prev, q: toggleLabelSearch(prev.q, name, action) || undefined }),
  });
};
