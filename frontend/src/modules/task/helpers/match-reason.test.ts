import { parseTerms } from 'shared/utils/text-match';
import { describe, expect, it } from 'vitest';
import type { Task } from '~/modules/task/types';
import { hiddenMatchReason } from './match-reason';

const paragraph = (text: string) =>
  JSON.stringify([{ id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] }]);

const task = {
  id: 'task-1',
  summary: paragraph('Passkey sign-in loops'),
  description: paragraph(`Passkey sign-in loops. ${'x '.repeat(80)}Probably the session cookie: private windows drop it after the redirect.`),
  labels: [{ id: 'l1', name: 'Auth' }],
  assignedTo: [{ id: 'u1', name: 'Renée Bakker' }],
} as unknown as Task;

describe('hiddenMatchReason', () => {
  it('is null when the summary or a label shows the term', () => {
    expect(hiddenMatchReason(task, parseTerms('passkey'))).toBeNull();
    expect(hiddenMatchReason(task, parseTerms('auth'))).toBeNull();
    expect(hiddenMatchReason(task, [])).toBeNull();
  });

  it('windows the description around a term below the summary', () => {
    const reason = hiddenMatchReason(task, parseTerms('cookie'));
    expect(reason?.description).toMatch(/^….*session cookie.*$/);
    expect(reason?.description?.length).toBeLessThanOrEqual(102);
    expect(reason?.people).toEqual([]);
  });

  it('names assignees matched through accents', () => {
    expect(hiddenMatchReason(task, parseTerms('renee'))).toEqual({ description: undefined, people: ['Renée Bakker'] });
  });

  it('is null when only unmatched terms are hidden', () => {
    expect(hiddenMatchReason(task, parseTerms('passkey nothing'))).toBeNull();
  });
});
