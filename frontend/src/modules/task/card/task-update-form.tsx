import i18n from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { appConfig, isUnconditionalCan } from 'shared';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNote } from '~/modules/common/blocknote/blocknote-editor';
import { checkedExtension } from '~/modules/common/blocknote/custom-elements/checklist/checklist-extension';
import { useYjsConnection } from '~/modules/common/blocknote/yjs-connections';
import { toaster } from '~/modules/common/toaster/toaster';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { useProjectMembers } from '~/modules/task/hooks/use-project-members';
import { useTaskDescriptionUpdate } from '~/modules/task/hooks/use-task-description-update';
import { useTaskFilePanelProps } from '~/modules/task/hooks/use-task-file-panel-props';
import { useUploadAttachments } from '~/modules/task/hooks/use-upload-attachments';
import { taskDescriptionGutterStyle } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { useCurrentUser, useUserStore, yjsTokenKey } from '~/modules/user/user-store';
import { getRandomColor } from '~/utils/random-color';

// Avoid bare `min-h-8`/`pb-4` here: BlockNoteView copies className to its portal element
// (see @blocknote/react BlockNoteView), which would add empty trailing height below the editor.
const expandedStyle = '[&>.bn-editor]:min-h-8 w-full bg-transparent border-none';
const expandedWrapperStyle = taskDescriptionGutterStyle;
const checkboxExtensions = [checkedExtension({ persisted: true })];

interface TaskUpdateFormProps {
  task: Task;
}

/**
 * Hosts the BlockNote editor for editing a task description.
 * Handles both collaborative (Yjs) and non-collaborative modes,
 * mutation logic, and cache updates.
 */
export function TaskUpdateForm({ task }: TaskUpdateFormProps) {
  const { tenantId } = useOrganizationLayoutContext();
  const user = useCurrentUser();

  const tokenKey = yjsTokenKey('task', tenantId);
  const yjsToken = useUserStore((s) => s.yjsTokens[tokenKey]);

  // Collaborative editing: requires yjsUrl, a token, online connectivity, and unconditional update permission.
  const yjsConfigured = !!appConfig.yjsUrl;
  const isOnline = useOnlineManager();
  const project = findProjectByIdOrSlug(task.projectId, tenantId);
  const canCollaborate = yjsConfigured && isOnline && !!yjsToken && isUnconditionalCan(project?.can?.task?.update);

  // Connect to Yjs relay; the connection manager handles ref-counting and grace periods.
  // The token proves update permission; entity-level access is verified asynchronously.
  const yjsConn = useYjsConnection(canCollaborate ? task.id : undefined, 'task', tenantId);

  const wsReady = yjsConn?.synced ?? false;

  // Wait briefly for WS sync before falling back to standalone mode.
  // This avoids mounting the editor twice (standalone → collaborative).
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!canCollaborate || wsReady) return;
    const timer = setTimeout(() => {
      setSyncTimedOut(true);
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toaster.warning(i18n.t('error:sync_failed.text'));
      }
    }, 3_000);
    return () => clearTimeout(timer);
  }, [canCollaborate, wsReady]);

  // While waiting for sync, don't render the editor yet
  const waitingForSync = canCollaborate && !wsReady && !syncTimedOut;
  const collaborative = canCollaborate && wsReady;

  const projectMembers = useProjectMembers(task.projectId, tenantId, task.organizationId);
  const { attachmentsCreationCallback } = useUploadAttachments();

  const updateData = useTaskDescriptionUpdate(task, collaborative);

  // Stable random color for cursor labels
  const userColorRef = useRef(getRandomColor());

  const collaborationBundle =
    collaborative && yjsConn
      ? {
          provider: yjsConn.provider,
          fragment: yjsConn.fragment,
          user: { name: user.name, color: userColorRef.current },
          entityType: 'task' as const,
          entityId: task.id,
        }
      : undefined;

  const handleEscapeOrBlur = () => {
    useTaskCardStore.getState().setTaskState(task.id, 'expanded');
  };

  // Uploaded attachments belong to this task (host relation)
  const baseFilePanel = useTaskFilePanelProps(
    task.projectId,
    tenantId,
    task.organizationId,
    attachmentsCreationCallback({ ...task, taskId: task.id }),
  );

  // Show faded read-only preview while waiting for WS sync (avoids empty flash)
  if (waitingForSync) {
    return (
      <div className="pointer-events-none select-none opacity-50">
        <TaskCardContentExpanded task={task} />
      </div>
    );
  }

  return (
    <div className={expandedWrapperStyle}>
      <BlockNote
        // Force a remount when the mode flips: useCreateBlockNote captures the
        // collaboration config at creation, so a late non-collab → collab switch
        // must not reuse the standalone editor instance.
        key={collaborative ? 'collab' : 'solo'}
        id={`blocknote-${task.id}`}
        editable
        autoFocus
        members={projectMembers}
        defaultValue={task.description ?? undefined}
        className={expandedStyle}
        dense
        updateData={updateData}
        onEnterClick={handleEscapeOrBlur}
        onEscapeClick={handleEscapeOrBlur}
        extensions={checkboxExtensions}
        baseFilePanelProps={baseFilePanel}
        trailingBlock={false}
        formattingToolbar={false}
        clickOpensPreview
        collaboration={collaborationBundle}
        onBeforeLoad={
          collaborative
            ? undefined
            : (editor) => {
                const strBlocks = JSON.stringify(editor.document);
                if (task.description === null || strBlocks === task.description) return;
                updateData(strBlocks);
              }
        }
      />
    </div>
  );
}
