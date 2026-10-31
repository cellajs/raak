import { describe, expect, it } from 'vitest';
import type { Task } from '~/modules/task/types';
import { matchesBoardSearch } from './search-filter';

const paragraph = (text: string) =>
  JSON.stringify([{ id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] }]);

const task = (overrides: Partial<Task> = {}) =>
  ({
    id: 'task-1',
    summary: paragraph('Realtime sync drops updates'),
    description: paragraph('Realtime sync drops updates. Renée can reproduce it in the café.'),
    keywords: 'realtime sync drops updates renée can reproduce it in the café',
    labels: [{ id: 'l1', name: 'Performance' }],
    assignedTo: [{ id: 'u1', name: 'Joost Kramer' }],
    ...overrides,
  }) as unknown as Task;

describe('matchesBoardSearch', () => {
  it('passes every task without a query, and the create form always', () => {
    expect(matchesBoardSearch('', task())).toBe(true);
    expect(matchesBoardSearch('missing', task({ _draft: true }))).toBe(true);
  });

  it('matches description, label and assignee text', () => {
    expect(matchesBoardSearch('drops', task())).toBe(true);
    expect(matchesBoardSearch('perform', task())).toBe(true);
    expect(matchesBoardSearch('kramer', task())).toBe(true);
    expect(matchesBoardSearch('missing', task())).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(matchesBoardSearch('RENEE', task())).toBe(true);
    expect(matchesBoardSearch('cafe', task())).toBe(true);
    expect(matchesBoardSearch('joöst', task())).toBe(true);
  });

  it('needs every word', () => {
    expect(matchesBoardSearch('sync kramer', task())).toBe(true);
    expect(matchesBoardSearch('sync missing', task())).toBe(false);
  });
});
