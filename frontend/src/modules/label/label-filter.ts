import { useSearchParams } from '~/hooks/use-search-params';

/**
 * Filter-by-label toggle over the shared board search: setting the search `q` to a label's
 * name filters tasks (backend matches label names into an array-overlap filter) and the
 * labels panel simultaneously. Toggling the same name again clears the filter.
 */
export const useLabelFilterToggle = () => {
  const { search, setSearch } = useSearchParams<{ q?: string }>({});
  const activeFilter = search.q ?? '';

  return {
    activeFilter,
    isActive: (name: string) => activeFilter === name,
    toggle: (name: string) => setSearch({ q: activeFilter === name ? '' : name }),
  };
};
