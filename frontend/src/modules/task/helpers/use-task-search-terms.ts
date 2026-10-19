import { useSearch } from '@tanstack/react-router';
import { parseSearchQuery } from 'shared/utils/parse-search-query';

/** The board search terms from the URL, for components under the board, the table and the task sheet. */
export const useTaskSearchTerms = (): string[] => {
  const q = useSearch({ strict: false, select: (search) => search.q });
  return parseSearchQuery(q).terms;
};
