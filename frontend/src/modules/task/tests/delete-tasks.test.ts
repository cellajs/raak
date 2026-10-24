import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '~/modules/task/types';

type DeleteFormProps = { onDelete: () => void; allowOfflineDelete?: boolean; pending: boolean };
const { shown, mutation } = vi.hoisted(() => ({
  shown: {} as { form?: DeleteFormProps },
  // A delete queued offline: its promise settles only once the network is back.
  mutation: { mutate: vi.fn(), mutateAsync: vi.fn(() => new Promise<never>(() => {})), isPending: false },
}));

vi.mock('~/modules/task/query', () => ({ useTaskDeleteMutation: () => mutation }));
// The buttons are left out: the test presses delete by calling the handler the form was given.
vi.mock('~/modules/common/delete-form', () => ({
  DeleteForm: (props: DeleteFormProps) => {
    shown.form = props;
    return null;
  },
}));

const { DeleteTasks } = await import('~/modules/task/delete-tasks');
const { OverlayCloseContext } = await import('~/modules/common/overlay-close');

const tasks = [{ id: 'task-1', tenantId: 'ten-1', organizationId: 'org-1' }] as Task[];

describe('DeleteTasks', () => {
  it('deletes offline as its hook does: the form lets the press through, and the dialog closes without waiting for the server', async () => {
    const callback = vi.fn();
    const close = vi.fn();
    renderToStaticMarkup(
      createElement(OverlayCloseContext.Provider, { value: { close, back: vi.fn() } }, createElement(DeleteTasks, { tasks, callback })),
    );

    expect(shown.form?.allowOfflineDelete).toBe(true);
    shown.form?.onDelete();
    await Promise.resolve();

    expect(close).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ data: tasks, status: 'success' });
  });
});
