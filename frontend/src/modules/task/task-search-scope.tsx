import type { ReactNode } from 'react';
import { MatchScope } from '~/modules/common/match-highlight';
import { useTaskSearchTerms } from '~/modules/task/hooks/use-task-search-terms';

/** Paints the board search terms in everything below: the board with its labels panel, the table, or the task sheet. */
interface TaskSearchScopeProps {
  children: ReactNode;
}

export function TaskSearchScope({ children }: TaskSearchScopeProps) {
  const terms = useTaskSearchTerms();
  return <MatchScope terms={terms}>{children}</MatchScope>;
}
