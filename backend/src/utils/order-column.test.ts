import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { getOrderColumns } from './order-column';

const dialect = new PgDialect();
const columns = {
  name: sql.identifier('name'),
  createdAt: sql.identifier('created_at'),
};
const id = sql.identifier('id');

describe('getOrderColumns', () => {
  it('uses explicit defaults and appends a same-direction tie-breaker', () => {
    const orderBy = getOrderColumns({
      sort: undefined,
      order: undefined,
      defaultSort: 'createdAt',
      defaultOrder: 'desc',
      columns,
      tieBreaker: id,
    });

    expect(orderBy.map((expression) => dialect.sqlToQuery(expression).sql)).toEqual(['"created_at" desc', '"id" desc']);
  });

  it('uses the requested sort and direction', () => {
    const orderBy = getOrderColumns({
      sort: 'name',
      order: 'asc',
      defaultSort: 'createdAt',
      defaultOrder: 'desc',
      columns,
    });

    expect(dialect.sqlToQuery(orderBy[0]).sql).toBe('"name" asc');
  });
});
