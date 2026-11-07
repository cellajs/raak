import { describe, expect, it } from 'vitest';
import type { RecentBoardSearch } from '~/modules/task/board/task-board-store';
import type { Task } from '~/modules/task/types';
import { fitBoardSearch, isWorthRecalling, matchesBoardSearch, parseBoardSearch, replaceFilterValue } from './search-filter';

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
    expect(matches({ status: ['started', 'unstarted'] })).toBe(true);
    expect(matches({ status: ['iced'] })).toBe(false);
    expect(matches({ status: ['delivered'] })).toBe(true);
    expect(parseBoardSearch({ status: ['delivered', 'iced'] }).statuses).toEqual(['iced']);
    expect(matches({ type: ['chore', 'bug'], labels: ['other', 'performance'] })).toBe(true);
    expect(matches({ type: ['bug'], labels: ['other'] })).toBe(false);
    expect(matches({ q: 'missing', type: ['bug'] })).toBe(false);
  });

  it('filters by assignee, and none for a task assigned to no one', () => {
    expect(matches({ assigned: ['u2', 'u1'] })).toBe(true);
    expect(matches({ assigned: ['u2'] })).toBe(false);
    expect(matches({ assigned: ['none'] })).toBe(false);
    expect(matches({ assigned: ['none'] }, { assignedTo: [] })).toBe(true);
    expect(matches({ assigned: ['u1'], type: ['chore'] })).toBe(false);
  });
});

describe('fitBoardSearch', () => {
  it('drops the values no task carries, and keeps You and No one', () => {
    const tasks = [task(), task({ assignedTo: [] })];
    expect(fitBoardSearch({ type: ['chore', 'bug'], labels: ['performance', 'gone'], assigned: ['u2', 'u1', 'none', 'me'] }, tasks, 'me')).toEqual({
      type: ['bug'],
      labels: ['performance'],
      assigned: ['u1', 'none', 'me'],
    });
    expect(fitBoardSearch({ type: ['chore'], assigned: ['u2'] }, tasks)).toEqual({ type: [], labels: [], assigned: [] });
  });

  it('keeps a known label whose tasks the lists leave out, as one accepted before the cut-off', () => {
    expect(fitBoardSearch({ labels: ['performance', 'old-epic', 'gone'] }, [task()], undefined, ['old-epic']).labels).toEqual([
      'performance',
      'old-epic',
    ]);
  });
});

describe('replaceFilterValue', () => {
  it('swaps one value in place and leaves the others', () => {
    expect(replaceFilterValue(['started', 'finished'], 'started', 'iced')).toEqual(['iced', 'finished']);
    expect(replaceFilterValue(['started'], 'started', 'iced')).toEqual(['iced']);
  });
});

describe('isWorthRecalling', () => {
  const worth = (q: string, filters: Partial<Omit<RecentBoardSearch, 'q'>>) =>
    isWorthRecalling({ q, status: [], type: [], labels: [], assigned: [], ...filters });

  it('skips a lone status, type or member', () => {
    expect(worth('', { status: ['backlog'] })).toBe(false);
    expect(worth('', { type: ['bug'] })).toBe(false);
    expect(worth('', { assigned: ['u1'] })).toBe(false);
  });

  it('skips words under three characters on their own', () => {
    expect(worth('kk', {})).toBe(false);
    expect(worth('kkk', {})).toBe(true);
  });

  it('keeps words, a label, and any combination', () => {
    expect(worth('kk', { type: ['bug'] })).toBe(true);
    expect(worth('', { labels: ['garden'] })).toBe(true);
    expect(worth('', { status: ['finished', 'reviewed'] })).toBe(true);
    expect(worth('', { status: ['backlog'], type: ['bug'] })).toBe(true);
    expect(worth('', { status: ['backlog'], assigned: ['u1'] })).toBe(true);
  });
});
