import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { FlameKindlingIcon, ServerCrashIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { TaskCard } from '~/modules/task/card/task-card';
import { publicTaskQueryOptions } from '~/modules/task/public-query';
import { taskQueryOptions } from '~/modules/task/query';

interface TaskSheetProps {
  id: string;
  organizationId: string | undefined;
}

function TaskSheet({ id, organizationId }: TaskSheetProps) {
  const isOnline = useOnlineManager();
  const { tenantId } = useParams({ strict: false });
  const { t } = useTranslation();

  // Select public or authenticated options before the unconditional hook call.
  // The cast bridges the factories' incompatible query-key types.
  const queryOpts =
    organizationId && tenantId ? taskQueryOptions(id, organizationId, tenantId) : publicTaskQueryOptions(id);
  const { data: task, isLoading, isError } = useQuery(queryOpts as ReturnType<typeof taskQueryOptions>);

  const isReadOnly = useIsProjectReadOnly(task?.projectId);

  // Sheet manages its own editing state, separate from the shared store.
  // Using the store would set the board card to 'editing' too, causing
  // a duplicate editor whose unmount flush overwrites sheet edits.
  const taskState = isReadOnly ? 'expanded' : 'editing';

  if (isError) return <ContentPlaceholder icon={ServerCrashIcon} title="error:request_failed" />;

  if (isLoading)
    return (
      <div className="block">
        <Spinner className="h-10 w-10" />
      </div>
    );

  if (!task)
    return (
      <ContentPlaceholder
        icon={isOnline ? FlameKindlingIcon : WifiOffIcon}
        title={isOnline ? 'c:no_resource_found' : 'c:offline.text'}
        titleProps={isOnline ? { resource: t('c:task').toLowerCase() } : undefined}
      />
    );

  return (
    <div>
      <TaskCard task={task} state={taskState} isSelected={false} isFocused={true} isSheet />
    </div>
  );
}

export { TaskSheet };
