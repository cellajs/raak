import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { FlameKindlingIcon, ServerCrashIcon, WifiOffIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { TaskCard } from '~/modules/task/card/task-card';
import { publicTaskQueryOptions } from '~/modules/task/public-query';
import { taskQueryOptions } from '~/modules/task/query';
import { TaskSearchScope } from '~/modules/task/task-search-scope';
import { isTouchInteraction } from '~/utils/input-modality';

interface TaskSheetProps {
  id: string;
  organizationId: string | undefined;
}

export function TaskSheet({ id, organizationId }: TaskSheetProps) {
  const isOnline = useOnlineManager();
  const tenantId = useParams({ strict: false, select: (params) => params.tenantId });
  const { t } = useTranslation();

  // Select public or authenticated options before the unconditional hook call.
  // The cast bridges the factories' incompatible query-key types.
  const queryOptions = organizationId && tenantId ? taskQueryOptions(id, organizationId, tenantId) : publicTaskQueryOptions(id);
  const { data: task, isLoading, isError } = useQuery(queryOptions as ReturnType<typeof taskQueryOptions>);

  const isReadOnly = useIsProjectReadOnly(task?.projectId);
  // A touch open starts expanded, as a touch tap on a board card does: editing would open the on-screen keyboard.
  const [isEditing, setIsEditing] = useState(() => !isTouchInteraction());

  // Own editing state: the shared store would set the board card to 'editing' too,
  // and that duplicate editor's unmount flush would overwrite sheet edits.
  const taskState = isReadOnly || !isEditing ? 'expanded' : 'editing';

  if (isError) return <ContentPlaceholder icon={ServerCrashIcon} title="error:request_failed" />;

  if (isLoading) {
    return (
      <div>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!task) {
    return (
      <ContentPlaceholder
        icon={isOnline ? FlameKindlingIcon : WifiOffIcon}
        title={isOnline ? 'c:no_resource_found' : 'c:offline.text'}
        titleProps={isOnline ? { resource: t('c:task').toLowerCase() } : undefined}
      />
    );
  }

  return (
    <TaskSearchScope>
      <div>
        <TaskCard task={task} state={taskState} isSelected={false} isFocused isSheet onEdit={() => setIsEditing(true)} />
      </div>
    </TaskSearchScope>
  );
}
