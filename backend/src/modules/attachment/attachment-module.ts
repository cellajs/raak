import { defineBackendModule } from '#/lib/module';
import { softDeleteAttachmentsByTaskIds } from '#/modules/attachment/attachment-queries';

defineBackendModule({
  name: 'attachments',
  owner: 'cella',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing file based attachments (such as images, PDFs, and documents) linked to
    entities such as organizations or users. Files are uploaded directly by the client, while the API handles
    metadata registration, linking, access, and preview utilities.`,
  onMutation: {
    // Lifecycle cascade: soft-delete a deleted task's attachments (host relation), reusing the
    // tasks' deletedAt/deletedBy. Runs inside the task-delete transaction (dispatched with txCtx).
    'task.deleted': async (ctx, { before = [] }) => {
      if (!before.length) return;
      const [{ deletedAt, deletedBy }] = before as { deletedAt: string; deletedBy: string }[];
      await softDeleteAttachmentsByTaskIds(ctx, {
        taskIds: before.map((task) => task.id as string),
        deletedAt,
        deletedBy,
      });
    },
  },
});
