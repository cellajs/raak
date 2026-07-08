import { useMemo } from 'react';
import type { UploadedUppyFile } from '~/modules/common/uploader/types';
import { useProjectPublicity } from '~/modules/task/hooks/use-project-publicity';

/**
 * Base props for the task attachment upload panel, shared by the create and update forms.
 * Resolves the project's publicity internally; `onComplete` receives the uploaded files
 * (the create form stashes them to link on submit, the update form links them immediately).
 */
export const useTaskFilePanelProps = (
  projectId: string,
  tenantId: string,
  organizationId: string,
  onComplete: (data: UploadedUppyFile<'attachment'>) => void,
) => {
  const isPublic = useProjectPublicity(projectId);
  return useMemo(
    () => ({ isPublic, tenantId, organizationId, onComplete }),
    [isPublic, tenantId, organizationId, onComplete],
  );
};
