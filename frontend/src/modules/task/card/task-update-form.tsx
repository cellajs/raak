import { useInfiniteQuery } from '@tanstack/react-query';
import i18n from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { appConfig, isUnconditionalPermission } from 'shared';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNote } from '~/modules/common/blocknote/block-note-editor';
import { checkedExtension } from '~/modules/common/blocknote/custom-elements/checklist/checklist-extension';
import { useYjsConnection } from '~/modules/common/blocknote/yjs-connections';
import { toaster } from '~/modules/common/toaster/toaster';
import { membersListQueryOptions } from '~/modules/memberships/query';
import type { Member } from '~/modules/memberships/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { deriveDescriptionProps } from '~/modules/task/helpers/derive-description-props';
import { useProjectPublicity } from '~/modules/task/hooks/use-project-publicity';
import { changeTaskState } from '~/modules/task/hooks/use-task-states';
import { useUploadAttachments } from '~/modules/task/hooks/use-upload-attachments';
import { taskKeys, useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { useUserStore, yjsTokenKey } from '~/modules/user/user-store';
import { cacheUpdate } from '~/query/basic/cache-mutations';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { flattenInfiniteData } from '~/query/basic/flatten';
import type { ItemData } from '~/query/basic/types';
import { queryClient } from '~/query/query-client';
import { getRandomColor } from '~/utils/random-color';

// Avoid bare `min-h-8`/`pb-4` here: BlockNoteView copies className to its portal element
// (see @blocknote/react BlockNoteView), which would add empty trailing height below the editor.
const expandedStyle = '[&>.bn-editor]:min-h-8 w-full bg-transparent border-none';
const expandedWrapperStyle = 'pl-1 sm:pl-9 pb-4';
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
  const user = useUserStore((s) => s.user);

  const tokenKey = yjsTokenKey('task', tenantId);
  const yjsToken = useUserStore((s) => s.yjsTokens[tokenKey]);

  // Collaborative editing: requires yjsUrl, a token, online connectivity, and unconditional update permission.
  const yjsConfigured = !!appConfig.yjsUrl;
  const isOnline = useOnlineManager();
  const project = findProjectByIdOrSlug(task.projectId, tenantId);
  const canCollaborate =
    yjsConfigured && isOnline && !!yjsToken && isUnconditionalPermission(project?.can?.task?.update);

  // Connect to Yjs relay — the connection manager handles ref-counting and grace periods.
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
        toaster(i18n.t('error:sync_failed.text'), 'warning');
      }
    }, 3_000);
    return () => clearTimeout(timer);
  }, [canCollaborate, wsReady]);

  // While waiting for sync, don't render the editor yet
  const waitingForSync = canCollaborate && !wsReady && !syncTimedOut;
  const collaborative = canCollaborate && wsReady;

  const membersQuery = useInfiniteQuery(
    membersListQueryOptions({
      entityId: task.projectId,
      tenantId,
      organizationId: task.organizationId,
      entityType: 'project',
    }),
  );
  const members = flattenInfiniteData<Member>(membersQuery.data);
  const projectMembers = members.filter(({ membership }) => membership.projectId === task.projectId);

  const projectPublicity = useProjectPublicity(task.projectId);
  const { attachmentsCreationCallback } = useUploadAttachments();

  const { mutateAsync: updateDesc } = useTaskUpdateMutation(task.tenantId, task.organizationId);
  const orgKey = taskKeys.list.org(task.organizationId);

  const updateData = async (description: string) => {
    // Sync description to detail + list cache immediately for instant remounts
    queryClient.setQueryData<Task>(taskKeys.detail.byId(task.id), (old) =>
      old ? { ...old, description, updatedAt: new Date().toISOString() } : undefined,
    );

    const cached = findInCache<Task>('task', task.id);
    if (cached) cacheUpdate(orgKey, [{ ...cached, description, updatedAt: new Date().toISOString() } as ItemData]);

    // In collaborative mode, derived fields sender handles backend persistence
    if (collaborative) return;

    // Skip if the task was deleted (e.g. unmount flush after deletion)
    if (!findInCache<Task>('task', task.id)) return;

    const { summary, summaryLength } = await deriveDescriptionProps(description);
    await updateDesc({ id: task.id, ops: { description }, summary, summaryLength });
  };

  const sendDerivedUpdate = async (id: string, description: string) => {
    if (!findInCache<Task>('task', id)) return;
    const { summary, summaryLength } = await deriveDescriptionProps(description);
    await updateDesc({ id, ops: { description }, summary, summaryLength });
  };

  // Stable random color for cursor labels
  const userColorRef = useRef(getRandomColor());

  const collaborationConfig =
    collaborative && yjsConn
      ? {
          provider: yjsConn.provider,
          fragment: yjsConn.fragment,
          user: { name: user.name, color: userColorRef.current },
          showCursorLabels: 'activity' as const,
        }
      : undefined;

  const handleEscapeOrBlur = () => {
    changeTaskState(task.id, 'expanded');
  };

  const baseFilePanel = {
    isPublic: projectPublicity,
    tenantId,
    organizationId: task.organizationId,
    onComplete: attachmentsCreationCallback(task),
  };

  // Show faded read-only preview while waiting for WS sync (avoids empty flash)
  if (waitingForSync) {
    return (
      <div className="pointer-events-none select-none opacity-50">
        <TaskCardContentExpanded task={task} />
      </div>
    );
  }

  if (collaborative && collaborationConfig) {
    return (
      <div className={expandedWrapperStyle}>
        <BlockNote
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
          collaboration={collaborationConfig}
          entityType="task"
          entityId={task.id}
          sendDerivedUpdate={sendDerivedUpdate}
        />
      </div>
    );
  }

  return (
    <div className={expandedWrapperStyle}>
      <BlockNote
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
        onBeforeLoad={(editor) => {
          const strBlocks = JSON.stringify(editor.document);
          if (task.description === null || strBlocks === task.description) return;
          updateData(strBlocks);
        }}
        clickOpensPreview
      />
    </div>
  );
}
