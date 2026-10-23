import type { Attachment } from 'sdk';
import { persistAttachments } from '~/modules/attachment/helpers/persist-attachments';

interface TaskUploadScope {
  organizationId: string;
  tenantId: string;
  projectId: string;
}

/** Returns a callback that persists the uploads of a task description into the task's project, through the shared attachment create path. */
export const createTaskUploadPersister =
  ({ organizationId, tenantId, projectId }: TaskUploadScope) =>
  (attachments: Attachment[]) => {
    // Task linkage lives in the description's attachmentId block props; the home is the task's project.
    persistAttachments(attachments, { tenantId, organizationId, placement: { projectId } });
  };
