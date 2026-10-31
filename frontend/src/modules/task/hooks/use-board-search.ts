import { useSearch } from '@tanstack/react-router';
import { parseBoardSearch } from '~/modules/task/helpers/search-filter';

/** The board search in the URL, parsed. */
export const useBoardSearch = () => {
  const q = useSearch({ strict: false, select: (search) => search.q });
  const status = useSearch({ strict: false, select: (search) => search.status });
  const type = useSearch({ strict: false, select: (search) => search.type });
  const labels = useSearch({ strict: false, select: (search) => search.labels });
  return parseBoardSearch({ q, status, type, labels });
};
