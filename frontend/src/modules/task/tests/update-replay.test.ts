import '~/query/tests/query-client-env';
import { describe, expect, it, vi } from 'vitest';

type Req = { body: { ops: Record<string, unknown>; stx: { mutationId: string; replayed?: boolean; fieldTimestamps: Record<string, string> } } };
const { updateTask, updateLabel } = vi.hoisted(() => ({
  updateTask: vi.fn(async (_req: Req) => ({ id: 'task-1' })),
  updateLabel: vi.fn(async (_req: Req) => ({ id: 'label-1' })),
}));

vi.mock('sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('sdk')>()), updateTask, updateLabel }));

import { updateLabelMutationFn } from '~/modules/label/query';
import { updateTaskMutationFn } from '~/modules/task/query';
import { recordPausedMutation } from '~/query/offline/mutation-queue';

const ctx = { tenantId: 'ten-1', organizationId: 'org-1' };
const persistedStx = (mutationId: string) => ({ mutationId, sourceId: 'tab-1', fieldTimestamps: { name: '1710500000123:0001:abcde' } });

describe('task and label updates replayed from the offline queue', () => {
  it('a live task edit carries no replay flag, so the server orders it by arrival', async () => {
    await updateTaskMutationFn({ ...ctx, id: 'task-1', ops: { name: 'Renamed' } });
    expect(updateTask.mock.lastCall?.[0].body.stx.replayed).toBeUndefined();
  });

  it('a task edit that paused offline is flagged and keeps its field timestamps', async () => {
    const stx = persistedStx('task-paused');
    recordPausedMutation(stx.mutationId);
    await updateTaskMutationFn({ ...ctx, id: 'task-1', ops: { name: 'Renamed' }, stx });
    expect(updateTask.mock.lastCall?.[0].body.stx).toEqual({ ...stx, replayed: true });
  });

  it('a label edit that paused offline is flagged too', async () => {
    const stx = persistedStx('label-paused');
    recordPausedMutation(stx.mutationId);
    await updateLabelMutationFn({ ...ctx, id: 'label-1', ops: { name: 'Renamed' }, stx });
    expect(updateLabel.mock.lastCall?.[0].body.stx).toEqual({ ...stx, replayed: true });
  });
});
