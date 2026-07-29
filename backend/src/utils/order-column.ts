import { type AnyColumn, asc, desc, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * Resolve API sorting to deterministic Drizzle `.orderBy()` expressions.
 */
export const getOrderColumns = <T extends Record<string, AnyColumn | SQLWrapper>, U extends keyof T>({
  sort,
  order,
  defaultSort,
  defaultOrder,
  columns,
  tieBreaker,
}: {
  sort: U | undefined;
  order: 'asc' | 'desc' | undefined;
  defaultSort: U;
  defaultOrder: 'asc' | 'desc';
  columns: T;
  tieBreaker?: AnyColumn | SQLWrapper;
}): SQL[] => {
  const orderFunc = (order ?? defaultOrder) === 'asc' ? asc : desc;
  const selected = columns[sort ?? defaultSort] ?? columns[defaultSort];
  const primaryOrder = orderFunc(selected);

  return tieBreaker && selected !== tieBreaker ? [primaryOrder, orderFunc(tieBreaker)] : [primaryOrder];
};
