import type { RefObject } from 'react';
import { isUnconditionalCan } from 'shared';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import type { BlockNoteContentApi } from '~/modules/common/blocknote/blocknote-editor';
import { CollaborativeBlockNote } from '~/modules/common/blocknote/collaborative-blocknote';
import { checkedExtension } from '~/modules/common/blocknote/custom-elements/checklist/checklist-extension';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { useProjectMembers } from '~/modules/project/use-project-members';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { useTaskDescriptionUpdate } from '~/modules/task/hooks/use-task-description-update';
import { useTaskFilePanelProps } from '~/modules/task/hooks/use-task-file-panel-props';
import { useUploadAttachments } from '~/modules/task/hooks/use-upload-attachments';
import { taskDescriptionGutterStyle } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';

// Avoid bare `min-h-8`/`pb-4` here: BlockNoteView copies className to its portal element
// (see @blocknote/react BlockNoteView), which would add empty trailing height below the editor.
const expandedStyle = '[&>.bn-editor]:min-h-8 w-full bg-transparent border-none';
const expandedWrapperStyle = taskDescriptionGutterStyle;
const checkboxExtensions = [checkedExtension({ persisted: true })];

interface TaskUpdateFormProps {
  task: Task;
  /** Exposes the editor's imperative API to the parent slot (handoff, warm-on-hover, checkbox toggle). */
  contentApiRef?: RefObject<BlockNoteContentApi | null>;
  /** True when this is the focused editing editor; false when it is only warmed behind the static view. */
  active?: boolean;
  /** Fires once the editor is mounted. */
  onEditorReady?: () => void;
}

/**
 * Hosts the collaborative BlockNote editor for editing a task description; the shared
 * CollaborativeBlockNote owns the Yjs gates and fallback, this wires task specifics
 * (permission, members, attachments, card-state handlers, cache policy).
 */
export function TaskUpdateForm({ task, contentApiRef, active = true, onEditorReady }: TaskUpdateFormProps) {
  const { tenantId } = useOrganizationLayoutContext();

  const project = findProjectByIdOrSlug(task.projectId, tenantId);
  const canEdit = isUnconditionalCan(project?.can?.task?.update);

  const projectMembers = useProjectMembers(task.projectId, tenantId, task.organizationId);
  const { attachmentsCreationCallback } = useUploadAttachments();
  const updateData = useTaskDescriptionUpdate(task);

  const handleEscapeOrBlur = () => {
    useTaskCardStore.getState().setTaskState(task.id, 'expanded');
  };

  // Task linkage for uploads rides the description's attachmentId block props.
  const baseFilePanel = useTaskFilePanelProps(
    task.projectId,
    tenantId,
    task.organizationId,
    attachmentsCreationCallback({ ...task }),
  );

  return (
    <div className={expandedWrapperStyle}>
      <CollaborativeBlockNote
        entityType="task"
        entityId={task.id}
        tenantId={tenantId}
        canEdit={canEdit}
        description={task.description}
        updateData={updateData}
        contentApiRef={contentApiRef}
        onEditorReady={onEditorReady}
        waitingFallback={
          // Faded read-only preview while waiting for WS sync (avoids empty flash).
          // noGutter: the wrapper already applies taskDescriptionGutterStyle, so the preview
          // aligns with the editor that replaces it and the swap causes no reflow.
          <div className="pointer-events-none select-none opacity-50">
            <TaskCardContentExpanded task={task} noGutter />
          </div>
        }
        editable
        autoFocus={active}
        members={projectMembers}
        className={expandedStyle}
        dense
        onEnterClick={handleEscapeOrBlur}
        onEscapeClick={handleEscapeOrBlur}
        extensions={checkboxExtensions}
        baseFilePanelProps={baseFilePanel}
        trailingBlock={false}
        formattingToolbar={false}
        clickOpensPreview
      />
    </div>
  );
}
