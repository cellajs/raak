import { PencilOffIcon } from 'lucide-react';
import { create } from 'zustand';
import { NamedText } from '~/modules/common/named-text';
import { useIsProjectGuest } from '~/modules/project/use-read-only';
import { Alert, AlertDescription } from '~/modules/ui/alert';
import { cn } from '~/utils/cn';

// Not persisted: closing holds for every view of the project until the page reloads
const useClosedGuestAlerts = create<{ projectIds: string[] }>(() => ({ projectIds: [] }));

const closeGuestAlert = (projectId: string) => useClosedGuestAlerts.setState((state) => ({ projectIds: [...state.projectIds, projectId] }));

interface TaskGuestAlertProps {
  projectId: string;
  className?: string;
}

/** Tells a guest why a project's tasks are read-only, until closed for that project. */
export function TaskGuestAlert({ projectId, className }: TaskGuestAlertProps) {
  const isGuest = useIsProjectGuest(projectId);
  const isClosed = useClosedGuestAlerts((state) => state.projectIds.includes(projectId));
  if (!isGuest || isClosed) return null;

  return (
    <Alert variant="info" onClose={() => closeGuestAlert(projectId)} className={cn('w-auto', className)}>
      <PencilOffIcon />
      <AlertDescription>
        <NamedText i18nKey="c:guest_read_only.text" />
      </AlertDescription>
    </Alert>
  );
}
