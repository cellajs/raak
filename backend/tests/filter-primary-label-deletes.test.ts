import { describe, expect, it, vi } from 'vitest';
import type { ActorContext } from '#/core/context';

const databaseError = new Error('connection terminated unexpectedly');

vi.mock('#/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/permissions')>()),
  getValidChannel: async () => {
    throw databaseError;
  },
}));
vi.mock('#/modules/label/label-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/modules/label/label-queries')>()),
  findLiveLabelModes: async () => [{ id: 'primary-label', mode: 'primary', projectId: 'project' }],
}));

const { filterPrimaryLabelDeletes } = await import('#/modules/label/operations/filter-primary-label-deletes');

describe('Primary label delete filter', () => {
  it('passes on a failure of the project check that is no refusal', async () => {
    // The queries and the project check are mocked, so the context is never read.
    const ctx = {} as ActorContext;

    await expect(filterPrimaryLabelDeletes(ctx, ['primary-label'], new Set())).rejects.toBe(databaseError);
  });
});
