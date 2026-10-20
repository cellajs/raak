import type { ReactNode } from 'react';
import { MatchScope } from '~/modules/common/match-highlight';
import { useTaskSearchTerms } from '~/modules/task/helpers/use-task-search-terms';

/** Paints the board search terms in everything below: the board with its labels panel, the table, or the task sheet. */
export function TaskSearchScope({ children }: { children: ReactNode }) {
  const terms = useTaskSearchTerms();
  return <MatchScope terms={terms}>{children}</MatchScope>;
}
