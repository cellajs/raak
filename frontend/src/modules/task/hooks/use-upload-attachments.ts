import { useMutation } from '@tanstack/react-query';
// biome-ignore lint/style/noRestrictedImports: colocated mutation hook wrapping createAttachments with task-specific cache update logic.
import { type Attachment, type CreateAttachmentsData, type CreateAttachmentsResponse, createAttachments } from 'sdk';
import type { ApiError } from '~/lib/api';
import { getProjectPublicAt } from '~/modules/project/query';
import { createStxForCreate } from '~/query/offline/stx-utils';

/** Provides upload attachments state and actions. */
export const useUploadAttachments = () => {
  const { mutate } = useMutation<
    CreateAttachmentsResponse,
    ApiError,
    { body: CreateAttachmentsData['body'] } & CreateAttachmentsData['path']
  >({
    mutationKey: ['attachments', 'create'],
    mutationFn: ({ tenantId, organizationId, body }) => createAttachments({ body, path: { tenantId, organizationId } }),
  });

  const attachmentsCreationCallback =
    ({
      organizationId,
      tenantId,
      projectId,
      taskId,
    }: {
      organizationId: string;
      tenantId: string;
      projectId: string;
      taskId?: string;
    }) =>
    (attachments: Attachment[]) => {
      // The panel parses uploads org-scoped only; add raak's linkage (projectId is required,
      // taskId ties the attachment to its owning task) before persisting. Stamp publicAt from the
      // parent project so the attachment inherits its project's publicity at create time.
      const publicAt = getProjectPublicAt(projectId, tenantId);
      const createdAttachments = attachments.map((att) => ({ ...att, projectId, taskId, publicAt }));

      const stx = createStxForCreate();
      // Body is array with stx embedded in each item
      const body = createdAttachments.map((att) => ({ ...att, stx }));
      mutate({
        body,
        tenantId,
        organizationId,
      });
      return createdAttachments;
    };

  return { attachmentsCreationCallback };
};
