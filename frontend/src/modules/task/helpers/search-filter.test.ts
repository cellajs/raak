import { describe, expect, it } from 'vitest';
import type { Task } from '~/modules/task/types';
import { isExcludedBySearch, matchesBoardSearch } from './search-filter';

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
    expect(matchesBoardSearch({ q: '' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'missing' }, task({ _draft: true }))).toBe(true);
  });

  it('matches description, label and assignee text', () => {
    expect(matchesBoardSearch({ q: 'drops' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'perform' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'kramer' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'missing' }, task())).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(matchesBoardSearch({ q: 'RENEE' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'cafe' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'joöst' }, task())).toBe(true);
  });

  it('needs every word in all mode and one in any mode', () => {
    expect(matchesBoardSearch({ q: 'sync kramer' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'sync missing' }, task())).toBe(false);
    expect(matchesBoardSearch({ q: 'sync missing', matchMode: 'any' }, task())).toBe(true);
  });

  it('strips the highlight marker', () => {
    expect(matchesBoardSearch({ q: '=drops' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: '=' }, task({ description: null }))).toBe(true);
  });

  it('leaves a task out on an excluded whole word, in any mode', () => {
    expect(matchesBoardSearch({ q: '-performance' }, task())).toBe(false);
    expect(matchesBoardSearch({ q: 'drops -"joost kramer"' }, task())).toBe(false);
    expect(matchesBoardSearch({ q: 'missing sync -cafe', matchMode: 'any' }, task())).toBe(false);
    expect(isExcludedBySearch('=drops -kramer', task())).toBe(true);
  });

  it('spares a task where the excluded word is only part of a word', () => {
    expect(matchesBoardSearch({ q: '-perform' }, task())).toBe(true);
    expect(matchesBoardSearch({ q: 'drops -sync -pro' }, task({ description: null, keywords: 'drops' }))).toBe(true);
    expect(isExcludedBySearch('-sync', task({ _draft: true }))).toBe(false);
  });
});
