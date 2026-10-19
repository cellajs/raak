import { describe, expect, it } from 'vitest';
import type { Task } from '~/modules/task/types';
import { searchFilterFunction } from './search-filter';

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

describe('searchFilterFunction', () => {
  it('passes every task without a query, and the create form always', () => {
    expect(searchFilterFunction({ q: '' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'missing' }, task({ id: 'create-task-p1' }))).toBe(true);
  });

  it('matches description, label and assignee text', () => {
    expect(searchFilterFunction({ q: 'drops' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'perform' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'kramer' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'missing' }, task())).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(searchFilterFunction({ q: 'RENEE' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'cafe' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'joöst' }, task())).toBe(true);
  });

  it('needs every word in all mode and one in any mode', () => {
    expect(searchFilterFunction({ q: 'sync kramer' }, task())).toBe(true);
    expect(searchFilterFunction({ q: 'sync missing' }, task())).toBe(false);
    expect(searchFilterFunction({ q: 'sync missing', matchMode: 'any' }, task())).toBe(true);
  });

  it('strips the highlight marker', () => {
    expect(searchFilterFunction({ q: '=drops' }, task())).toBe(true);
    expect(searchFilterFunction({ q: '=' }, task({ description: null }))).toBe(true);
  });
});
