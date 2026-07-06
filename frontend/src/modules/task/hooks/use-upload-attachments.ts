import { useMutation } from '@tanstack/react-query';
// biome-ignore lint/style/noRestrictedImports: this file IS a colocated mutation hook — wraps createAttachments with task-specific cache update logic.
import { type CreateAttachmentsData, type CreateAttachmentsResponse, createAttachments } from 'sdk';
import type { ApiError } from '~/lib/api';
import { parseUploadedAttachments } from '~/modules/attachment/helpers/parse-uploaded';
import type { UploadedUppyFile } from '~/modules/common/uploader/types';
import { createStxForCreate } from '~/query/offline/stx-utils';

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
    (data: UploadedUppyFile<'attachment'>) => {
      // cella change: projectId is required in raak; taskId links the attachment to its owning task (host relation)
      const createdAttachments = parseUploadedAttachments(data, organizationId, projectId, taskId);

      const stx = createStxForCreate();
      // Body is array with stx embedded in each item
      const body = createdAttachments.map((att) => ({ ...att, stx }));
      mutate({
        body,
        tenantId,
        organizationId: organizationId,
      });
      return createdAttachments;
    };

  return {
    attachmentsCreationCallback, // Return the renamed callback
  };
};
