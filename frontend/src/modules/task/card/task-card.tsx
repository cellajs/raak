import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { FocusEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DropIndicator } from '~/modules/common/drop-indicator';
import { FocusTrap } from '~/modules/common/focus-trap';
import { getSeenChannelId } from '~/modules/seen/helpers';
import { SeenMark } from '~/modules/seen/seen-mark';
import { TaskCardContentCollapsed } from '~/modules/task/card/card-content-collapsed';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { TaskCardDragPreview } from '~/modules/task/card/card-drag-preview';
import { TaskCardFooter } from '~/modules/task/card/card-footer';
import { TaskCardHeader } from '~/modules/task/card/card-header';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { TaskUpdateForm } from '~/modules/task/card/task-update-form';
import { isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { setTaskCardFocus } from '~/modules/task/helpers/focus-task';
import { toggleTaskCheckbox } from '~/modules/task/helpers/toggle-checkbox';
import { useIsProjectReadOnly } from '~/modules/task/hooks/use-read-only';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { TaskProps } from '~/modules/task/types';
import { Card, CardContent } from '~/modules/ui/card';
import { cn } from '~/utils/cn';
import { getDraggableItemData } from '~/utils/get-draggable-item-data';

import '~/modules/task/card/card-glow.css';
import { StickyBox } from '~/modules/common/sticky-box';
import { useMobileTaskDragIndicatorStore } from '~/modules/task/board/mobile-drag-indicator-store';
import { taskCardVariants } from '~/modules/task/task-styles';

interface PortalDataProps {
  container: HTMLElement;
  rect: DOMRect;
}

/**
 * Manage task card rendering and interactions, including click/double-click behavior, focus management, and drag-and-drop for reordering.
 */
const TaskCard = memo(function TaskCard({ task, isSelected, isFocused, state, isSheet }: TaskProps) {
  const taskRef = useRef<HTMLDivElement>(null);
  const expandedAtRef = useRef<number>(0);
  const isReadOnly = useIsProjectReadOnly(task.projectId);
  const { mutate: mutateTask } = useTaskUpdateMutation(task.tenantId, task.organizationId);
  const mobileClosestEdge = useMobileTaskDragIndicatorStore((store) =>
    store.indicator?.taskId === task.id ? store.indicator.edge : null,
  );

  // Cap editing to expanded in read-only mode
  const effectiveState = isReadOnly && state === 'editing' ? 'expanded' : state;

  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [portalData, setPortalData] = useState<PortalDataProps | null>(null);

  const dragEnd = () => {
    setClosestEdge(null);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const clickTarget = event.target as HTMLElement;

    // Remaining interactions only apply outside sheet mode
    if (isSheet) return;

    if (!isFocused) setTaskCardFocus(task.id);

    // Ignore clicks that are text selection (user dragged to highlight) within this card
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0 && taskRef.current?.contains(selection.anchorNode)) return;

    // Intercept checkbox clicks in expanded state: toggle data directly, stay expanded.
    if (state === 'expanded' && !isReadOnly) {
      const wrapper = clickTarget.closest('.checklist-checkbox-wrapper') ?? clickTarget.closest('.checklist-item');
      const checkboxId = wrapper?.querySelector<HTMLInputElement>('input.checklist-checkbox')?.dataset.checkboxId;
      if (checkboxId && task.description) {
        event.preventDefault();
        toggleTaskCheckbox(task, checkboxId, mutateTask);
        return;
      }
    }

    // Ignore clicks on interactive elements
    const interactive = clickTarget.closest(
      'button, a, input, textarea, select, [role="button"], [role="checkbox"], label',
    );
    if (interactive) return;

    // If collapsed, expand (read-only) or edit (normal)
    if (state === 'collapsed') {
      expandedAtRef.current = Date.now();
      useTaskCardStore.getState().setTaskState(task.id, isReadOnly ? 'expanded' : 'editing');
      return;
    }

    // Clicking the card edges while editing should not exit editing
    if (state === 'editing') return;

    // Re-enter editing when clicking an expanded card (skip in read-only)
    if (state === 'expanded' && !isReadOnly) {
      useTaskCardStore.getState().setTaskState(task.id, 'editing');
    }
  };

  // Register draggable only when collapsed so expanded cards allow text selection
  useEffect(() => {
    if (isSheet || isReadOnly || state !== 'collapsed') return;
    const element = taskRef.current;
    if (!element) return;

    return draggable({
      element,
      dragHandle: element,
      getInitialData: () => getDraggableItemData(task, task.displayOrder, 'task', 'task'),
      onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
        const rect = source.element.getBoundingClientRect();

        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: preserveOffsetOnSource({ element, input: location.current.input }),
          render({ container }) {
            setPortalData({ container, rect });
            return () => setPortalData(null);
          },
        });
      },
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [task, state, isSheet, isReadOnly]);

  // Register drop target (always active for receiving drags from other cards)
  useEffect(() => {
    if (isSheet) return;
    const element = taskRef.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const { data: sourceData } = source;
        if (!isTaskData(sourceData)) return false;
        if (sourceData.type !== 'task' || sourceData.item.status !== task.status) return false;
        // Block drops from other projects into a read-only project
        if (sourceData.item.projectId !== task.projectId && isReadOnly) return false;
        return true;
      },
      getIsSticky: () => true,
      getData: ({ input }) =>
        attachClosestEdge(getDraggableItemData(task, task.displayOrder, 'task', 'task'), {
          element,
          input,
          allowedEdges: ['top', 'bottom'],
        }),
      onDrag: ({ self: { data: selfData }, source: { data: sourceData } }) => {
        if (
          !isTaskData(sourceData) ||
          !isTaskData(selfData) ||
          sourceData.item.id === task.id ||
          sourceData.item.projectId !== task.projectId
        )
          return;
        setClosestEdge(extractClosestEdge(selfData));
      },
      onDragLeave: dragEnd,
      onDrop: dragEnd,
    });
  }, [task, isSheet, isReadOnly]);

  // Exit editing only when focus moves to another task card (not to dialogs, portals, or void).
  // Small delay lets BlockNote's blur handler flush content to cache and
  // BlockNoteFullHtml's async render complete before the static HTML becomes visible.
  const handleCardBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (state !== 'editing') return;
    const nextFocused = event.relatedTarget as HTMLElement | null;
    // Only exit editing if focus moved to another task card
    if (nextFocused?.closest?.('[data-task-card-id]') && !taskRef.current?.contains(nextFocused)) {
      setTimeout(() => useTaskCardStore.getState().setTaskState(task.id, 'expanded'), 50);
    }
  };

  const dropIndicatorEdge = mobileClosestEdge ?? closestEdge;

  return (
    <FocusTrap mainElementId={task.id} active={isFocused}>
      <Card
        id={isSheet ? `sheet-${task.id}` : task.id}
        onClick={handleCardClick}
        onBlur={handleCardBlur}
        data-state={effectiveState}
        // status to assign color of a glow
        data-status={task.status}
        data-task-card-id={task.id}
        data-project-id={task.projectId}
        data-read-only={isReadOnly ? 'true' : undefined}
        data-sheet={isSheet || undefined}
        draggable={!isSheet && !isReadOnly && effectiveState === 'collapsed'}
        data-exclude-from-focus-trap="true"
        tabIndex={0}
        ref={taskRef}
        className={cn(
          `group/task relative rounded-none border-0 border-b bg-linear-to-br bg-transparent from-transparent via-60% via-transparent to-100% py-0 pl-0.5 sm:py-0 ${task.isMatchingSearch ? `${isFocused ? 'bg-green-500/20 hover:bg-green-500/30!' : 'bg-green-300/20 hover:bg-green-300/30!'}` : ''}`,
          effectiveState !== 'collapsed' ? 'is-expanded' : 'is-collapsed',
          dragging ? 'opacity-30' : 'opacity-100',
          !isSheet && 'focus-visible:is-focused focus-visible:outline-none focus-visible:ring-0',
          isFocused && !isSheet && 'is-focused',
          isSheet ? 'min-h-[calc(100vh-3rem)] p-3 pt-0 sm:min-h-[calc(100vh-3.25rem)]' : 'hover:bg-card/20',
          taskCardVariants({ status: task.status }),
        )}
      >
        <CardContent
          id={`${task.id}-content`}
          className="space-between relative flex flex-col border-primary p-1.5! group-[.is-focused]/task:-ml-0.5 group-[.is-focused]/task:border-l-2 sm:px-2!"
        >
          <SeenMark
            productId={task.id}
            tenantId={task.tenantId}
            organizationId={task.organizationId}
            channelId={getSeenChannelId('task', task)}
            productType="task"
          />
          {effectiveState !== 'collapsed' && (
            <StickyBox
              className="z-10 backdrop-blur-sm data-[sticky=true]:-mx-2 data-[sticky=true]:bg-background/60 data-[sticky=true]:px-2"
              enabled={!isSheet}
              offsetBottom={52}
            >
              <TaskCardHeader task={task} isSheet={isSheet} />
            </StickyBox>
          )}
          {effectiveState === 'collapsed' ? (
            <TaskCardContentCollapsed task={task} />
          ) : effectiveState === 'editing' ? (
            <TaskUpdateForm task={task} />
          ) : (
            <TaskCardContentExpanded task={task} />
          )}
          <TaskCardFooter task={task} isSheet={isSheet} isSelected={isSelected} />
        </CardContent>
        {dropIndicatorEdge && <DropIndicator edge={dropIndicatorEdge} gap={0.25} />}
      </Card>
      {portalData &&
        createPortal(
          <div style={{ width: portalData.rect.width, height: portalData.rect.height }}>
            <TaskCardDragPreview task={task} />
          </div>,
          portalData.container,
        )}
    </FocusTrap>
  );
});

export { TaskCard };
