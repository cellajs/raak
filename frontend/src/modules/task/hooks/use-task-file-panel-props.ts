import { useMemo } from 'react';
import type { Attachment } from 'sdk';
import { useProjectPublicity } from '~/modules/task/hooks/use-project-publicity';

/**
 * Base props for the task attachment upload panel, shared by the create and update forms.
 * Resolves the project's publicity internally and maps it to the panel's media mode;
 * `onComplete` receives the panel-parsed attachments (the create form stashes them to link
 * on submit, the update form links them immediately).
 */
export const useTaskFilePanelProps = (
  projectId: string,
  tenantId: string,
  organizationId: string,
  onComplete: (attachments: Attachment[]) => void,
) => {
  const isPublic = useProjectPublicity(projectId);
  return useMemo(
    () => ({
      mediaMode: isPublic ? ('public-attachment' as const) : ('private-attachment' as const),
      tenantId,
      organizationId,
      onComplete,
    }),
    [isPublic, tenantId, organizationId, onComplete],
  );
};
