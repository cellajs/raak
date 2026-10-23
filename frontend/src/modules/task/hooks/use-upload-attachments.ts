import type { Attachment } from 'sdk';
import { persistAttachments } from '~/modules/attachment/helpers/persist-attachments';

/** Persists the uploads of a task description into the task's project, through the shared attachment create path. */
export const useUploadAttachments = () => {
  const attachmentsCreationCallback =
    ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) =>
    (attachments: Attachment[]) => {
      // Task linkage lives in the description's attachmentId block props; the home is the task's project.
      persistAttachments(attachments, { tenantId, organizationId, placement: { projectId } });
    };

  return { attachmentsCreationCallback };
};
