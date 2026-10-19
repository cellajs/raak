import type { Attachment } from 'sdk';
import { persistAttachments } from '~/modules/attachment/helpers/persist-attachments';
import { getProjectPublicAt } from '~/modules/project/query';

/** Persists the uploads of a task description into the task's project, through the shared attachment create path. */
export const useUploadAttachments = () => {
  const attachmentsCreationCallback =
    ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) =>
    (attachments: Attachment[]) => {
      // Task linkage lives in the description's attachmentId block props. The home is the task's project, and publicAt
      // comes from that project so the attachment inherits its publicity (client-sent, per cella/PERMISSIONS.md).
      const placement = { projectId, publicAt: getProjectPublicAt(projectId, tenantId) };
      persistAttachments(attachments, { tenantId, organizationId, placement });
    };

  return { attachmentsCreationCallback };
};
