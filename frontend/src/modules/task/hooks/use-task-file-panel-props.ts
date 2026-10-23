import type { Attachment } from 'sdk';
import { useProjectPublicity } from '~/modules/project/use-project-publicity';

/** Base props for the task attachment upload panel, shared by the create and update forms; `onComplete` receives the parsed attachments. */
export const useTaskFilePanelProps = (
  projectId: string,
  tenantId: string,
  organizationId: string,
  onComplete: (attachments: Attachment[]) => void,
) => {
  const isPublic = useProjectPublicity(projectId);
  return { mediaMode: isPublic ? 'public-attachment' : 'private-attachment', tenantId, organizationId, onComplete } as const;
};
