import { describe, expect, it, vi } from 'vitest';

const derive = vi.fn(async () => {});
vi.mock('#/modules/notification/operations/derive-mentions', () => ({
  deriveMentionsFor: vi.fn(() => derive),
}));

const { deriveTaskMentionsOnMaterialize, taskLink, taskNotifications } = await import('./task-notifications');

const ctx = {} as Parameters<typeof deriveTaskMentionsOnMaterialize>[0];

describe('deriveTaskMentionsOnMaterialize', () => {
  it('ignores client-origin writes, which cella already derives', async () => {
    await deriveTaskMentionsOnMaterialize(ctx, { after: [{ id: 't1' }], serverOrigin: false });
    expect(derive).not.toHaveBeenCalled();
  });

  it('re-dispatches Yjs materialization writes as client-origin so the stored body is derived from', async () => {
    const after = [{ id: 't1', description: '[]' }];
    await deriveTaskMentionsOnMaterialize(ctx, { after, serverOrigin: true });
    expect(derive).toHaveBeenCalledWith(ctx, { after, serverOrigin: false });
  });
});

describe('taskNotifications', () => {
  it('is mentionable and links emails to the task resolver route', () => {
    expect(taskNotifications.mentionable).toBe(true);
    expect(taskNotifications.resolveEmailLink?.({ subjectId: 'abc', contextId: null })).toBe(taskLink('abc'));
    expect(taskLink('abc')).toMatch(/\/t\/abc$/);
  });
});
