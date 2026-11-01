import { describe, expect, it } from 'vitest';
import type { Task } from '~/modules/task/types';
import { isWorthRecalling, matchesBoardSearch, parseBoardSearch, replaceFilterValue } from './search-filter';

const paragraph = (text: string) =>
  JSON.stringify([{ id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] }]);

const task = (overrides: Partial<Task> = {}) =>
  ({
    id: 'task-1',
    summary: paragraph('Realtime sync drops updates'),
    description: paragraph('Realtime sync drops updates. Renée can reproduce it in the café.'),
    keywords: 'realtime sync drops updates renée can reproduce it in the café',
    status: 5,
    primaryLabel: { id: 'p1', name: 'Bug', slug: 'bug' },
    labels: [{ id: 'l1', name: 'Performance', slug: 'performance' }],
    assignedTo: [{ id: 'u1', name: 'Joost Kramer' }],
    ...overrides,
  }) as unknown as Task;

const matches = (search: Parameters<typeof parseBoardSearch>[0], overrides?: Partial<Task>) =>
  matchesBoardSearch(parseBoardSearch(search), task(overrides));

describe('matchesBoardSearch', () => {
  it('passes every task without a search, and the create form always', () => {
    expect(matches({ q: '' })).toBe(true);
    expect(matches({ q: 'missing' }, { _draft: true })).toBe(true);
  });

  it('matches description, label and assignee text', () => {
    expect(matches({ q: 'drops' })).toBe(true);
    expect(matches({ q: 'perform' })).toBe(true);
    expect(matches({ q: 'kramer' })).toBe(true);
    expect(matches({ q: 'missing' })).toBe(false);
  });

  it('ignores case and accents', () => {
    expect(matches({ q: 'RENEE' })).toBe(true);
    expect(matches({ q: 'cafe' })).toBe(true);
    expect(matches({ q: 'joöst' })).toBe(true);
  });

  it('needs every word', () => {
    expect(matches({ q: 'sync kramer' })).toBe(true);
    expect(matches({ q: 'sync missing' })).toBe(false);
  });

  it('widens within a filter and narrows across filters and words', () => {
    expect(matches({ status: 'started,unstarted' })).toBe(true);
    expect(matches({ status: 'iced' })).toBe(false);
    expect(matches({ type: 'chore,bug', labels: 'other,performance' })).toBe(true);
    expect(matches({ type: 'bug', labels: 'other' })).toBe(false);
    expect(matches({ q: 'missing', type: 'bug' })).toBe(false);
  });
});

describe('replaceFilterValue', () => {
  it('swaps one value in place and leaves the others', () => {
    expect(replaceFilterValue('started,delivered', 'started', 'iced')).toBe('iced,delivered');
    expect(replaceFilterValue('started', 'started', 'iced')).toBe('iced');
  });
});

describe('isWorthRecalling', () => {
  const worth = (q: string, filters: Record<string, string[]>) => isWorthRecalling({ q, filters });

  it('skips a lone status or type', () => {
    expect(worth('', { status: ['backlog'], type: [], labels: [] })).toBe(false);
    expect(worth('', { status: [], type: ['bug'], labels: [] })).toBe(false);
  });

  it('keeps words, a label, and any combination', () => {
    expect(worth('kk', { status: [], type: ['bug'], labels: [] })).toBe(true);
    expect(worth('', { status: [], type: [], labels: ['garden'] })).toBe(true);
    expect(worth('', { status: ['delivered', 'reviewed'], type: [], labels: [] })).toBe(true);
    expect(worth('', { status: ['backlog'], type: ['bug'], labels: [] })).toBe(true);
  });
});
