import { type LabelAction, parseHiddenLabels, toggleHiddenLabel, toggleLabelSearch, withoutLabelSearch } from '~/modules/label/label-search';
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

/** A label tile's filter, highlight or hide toggle. Hiding takes the label out of the search; searching for it shows it again. */
export const applyLabelAction = (label: { name: string; slug: string }, action: LabelAction) => {
  getRouter().navigate({
    to: '.',
    replace: true,
    resetScroll: false,
    search: (prev) => {
      const isHidden = parseHiddenLabels(prev.hide).includes(label.slug);
      const q = action === 'hide' ? (isHidden ? prev.q : withoutLabelSearch(prev.q, label.name)) : toggleLabelSearch(prev.q, label.name, action);
      const hide = action === 'hide' || isHidden ? toggleHiddenLabel(prev.hide, label.slug) : prev.hide;
      return { ...prev, q: q || undefined, hide: hide || undefined };
    },
  });
};

/** Brings back every task the board's hidden labels leave out. */
export const showHiddenLabels = () => {
  getRouter().navigate({ to: '.', replace: true, resetScroll: false, search: (prev) => ({ ...prev, hide: undefined }) });
};
