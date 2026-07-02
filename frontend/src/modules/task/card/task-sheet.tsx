import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { FlameKindlingIcon, ServerCrashIcon, WifiOffIcon } from 'lucide-react';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import TaskCard from '~/modules/task/card/task-card';
import { useIsProjectReadOnly } from '~/modules/task/hooks/use-read-only';
import { publicTaskQueryOptions } from '~/modules/task/public-query';
import { taskQueryOptions } from '~/modules/task/query';

const TaskSheet = ({ id, organizationId }: { id: string; organizationId: string | undefined }) => {
  const isOnline = useOnlineManager();
  const { tenantId } = useParams({ strict: false });

  // Query task
  const {
    data: task,
    isLoading,
    isError,
  } = organizationId && tenantId
    ? useQuery(taskQueryOptions(id, organizationId, tenantId))
    : useQuery(publicTaskQueryOptions(id));

  const isReadOnly = useIsProjectReadOnly(task?.projectId);

  // Sheet manages its own editing state — don't use the shared store.
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
        title={`${isOnline ? 'c:no_task_found' : 'c:offline.text'}`}
      />
    );

  return (
    <div>
      <TaskCard task={task} state={taskState} isSelected={false} isFocused={true} isSheet />
    </div>
  );
};

export default TaskSheet;
