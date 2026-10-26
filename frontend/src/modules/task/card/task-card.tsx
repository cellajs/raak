import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { type FocusEvent, type MouseEvent, memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DropIndicator } from '~/modules/common/drop-indicator';
import { StickyBox } from '~/modules/common/sticky-box';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { getSeenChannelId } from '~/modules/seen/helpers';
import { SeenMark } from '~/modules/seen/seen-mark';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { useMobileTaskDragIndicatorStore } from '~/modules/task/board/mobile-task-drag-indicator-store';
import { useTaskDropLandingStore } from '~/modules/task/board/task-drop-landing-store';
import { CardDescriptionSlot } from '~/modules/task/card/card-description-slot';
import { TaskCardDragPreview } from '~/modules/task/card/task-card-drag-preview';
import { TaskCardFooter } from '~/modules/task/card/task-card-footer';
import { TaskCardHeader } from '~/modules/task/card/task-card-header';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { canDropTaskIntoProject, isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { focusItem, markCurrentItemMounted, setCurrentItem, takePendingFocus } from '~/modules/task/helpers/focus-item';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import { taskCardFocusBarClass, taskCardVariants } from '~/modules/task/task-styles';
import type { TaskProps } from '~/modules/task/types';
import { Card, CardContent } from '~/modules/ui/card';
import { cn } from '~/utils/cn';
import { getDraggableItemData } from '~/utils/get-draggable-item-data';
import { isTouchInteraction } from '~/utils/input-modality';
import '~/modules/task/card/card-glow.css';

interface DragPreviewPortal {
  container: HTMLElement;
  rect: DOMRect;
}

export const TaskCard = memo(function TaskCard({ task, isSelected, isFocused, state, isSheet, onEdit }: TaskProps) {
  const taskRef = useRef<HTMLDivElement>(null);
  const isReadOnly = useIsProjectReadOnly(task.projectId);
  const mobileClosestEdge = useMobileTaskDragIndicatorStore((state) => (state.indicator?.taskId === task.id ? state.indicator.edge : null));
  const landingEdge = useTaskDropLandingStore((state) => (state.landing?.taskId === task.id ? state.landing.edge : null));

  const effectiveState = isReadOnly && state === 'editing' ? 'expanded' : state;

  // The close button pops in and out only when the card opens or closes here, not when a row scrolls back into view
  const isOpen = effectiveState !== 'collapsed';
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [hasToggled, setHasToggled] = useState(false);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setHasToggled(true);
  }

  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [portalData, setPortalData] = useState<DragPreviewPortal | null>(null);

  const clearClosestEdge = () => {
    setClosestEdge(null);
  };

  const startEditing = () => {
    if (isSheet) onEdit?.();
    else taskCardStore.getState().setTaskState(task.id, 'editing');
  };

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    // The store, not isFocused: the mousedown before this click already made the card current through its focus
    if (!isSheet && useBoardFocusStore.getState().currentItemId !== task.id) focusItem(task.id);

    const selection = window.getSelection();
    if (selection && selection.toString().length > 0 && taskRef.current?.contains(selection.anchorNode)) return;

    const interactive =
      event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [role="button"], [role="checkbox"], label');
    if (interactive) return;

    if (isSheet) {
      if (state === 'expanded' && !isReadOnly) startEditing();
      return;
    }

    // A touch tap only expands: editing focuses the editor, which opens the on-screen keyboard. A second tap edits at its point.
    if (state === 'collapsed') {
      taskCardStore.getState().setTaskState(task.id, isReadOnly || isTouchInteraction() ? 'expanded' : 'editing');
      return;
    }

    // Clicking the card edges while editing should not exit editing
    if (state === 'expanded' && !isReadOnly) startEditing();
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
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [task, state, isSheet, isReadOnly]);

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
        return canDropTaskIntoProject(sourceData.item.projectId, task.projectId);
      },
      getIsSticky: () => true,
      getData: ({ input }) =>
        attachClosestEdge(getDraggableItemData(task, task.displayOrder, 'task', 'task'), { element, input, allowedEdges: ['top', 'bottom'] }),
      onDrag: ({ self: { data: selfData }, source: { data: sourceData } }) => {
        if (!isTaskData(sourceData) || !isTaskData(selfData) || sourceData.item.id === task.id) return;
        setClosestEdge(extractClosestEdge(selfData));
      },
      onDragLeave: clearClosestEdge,
      onDrop: clearClosestEdge,
    });
  }, [task, isSheet]);

  // Editing exits only when focus moves to another task card, not to dialogs or portals.
  // The delay lets BlockNote's blur handler flush to the cache and its async render finish before the static HTML shows.
  const handleCardBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (state !== 'editing') return;
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Element && nextFocused.closest('[data-task-card-id]') && !taskRef.current?.contains(nextFocused)) {
      setTimeout(() => taskCardStore.getState().setTaskState(task.id, 'expanded'), 50);
    }
  };

  // Focus and current are one: a card focused by a click or a script becomes the current task.
  // Reads the store: focusItem updates it before focusing, while isFocused still holds the last render.
  const handleCardFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (isSheet || event.target !== event.currentTarget) return;
    if (useBoardFocusStore.getState().currentItemId !== task.id) setCurrentItem(task.id);
  };

  const cardId = isSheet ? `sheet-${task.id}` : task.id;
  // A collapsed card is one Tab stop: Enter opens it, and only then does Tab reach its controls
  useItemControlsTabOrder(taskRef, cardId, !!isFocused && effectiveState !== 'collapsed', { trap: !isSheet });

  // Mounting as the current card: take the focus a keypress left for it, and hold the panel list's Tab stop
  useEffect(() => {
    if (isSheet || !isFocused) return;
    takePendingFocus(task.id, taskRef.current);
    return markCurrentItemMounted(task.id);
  }, [isSheet, isFocused, task.id]);

  const isCurrent = isFocused && !isSheet;
  const dropIndicatorEdge = mobileClosestEdge ?? closestEdge ?? landingEdge;

  return (
    <>
      <Card
        id={cardId}
        role="article"
        aria-label={task.name}
        onClick={handleCardClick}
        onFocus={handleCardFocus}
        onBlur={handleCardBlur}
        data-state={effectiveState}
        // read by card-glow.css
        data-status={task.status}
        data-task-card-id={task.id}
        data-project-id={task.projectId}
        data-read-only={isReadOnly || undefined}
        data-sheet={isSheet || undefined}
        data-match-current={isCurrent || undefined}
        draggable={!isSheet && !isReadOnly && effectiveState === 'collapsed'}
        tabIndex={isSheet || isFocused ? 0 : -1}
        ref={taskRef}
        className={cn(
          'group/task relative rounded-none border-0 border-b bg-linear-to-br bg-transparent from-transparent via-60% via-transparent py-0 sm:py-0',
          isDragging && 'opacity-30',
          !isSheet && 'focus-visible:outline-none',
          // Hover and current spread the status gradient; the tint is for unstarted cards, which have no gradient
          isCurrent && 'is-focused bg-accent/30 via-40%',
          isSheet
            ? 'min-h-[calc(100vh-var(--task-sheet-offset))] p-3 pt-0 sm:min-h-[calc(100vh-var(--task-sheet-offset-sm))]'
            : 'transition-[background-color,color,--tw-gradient-via-position] hover:bg-accent/30 hover:via-40%',
          // A search match or a selected card keeps full strength, so it stands out among the resting ones
          !isSheet && effectiveState === 'collapsed' && !isCurrent && !task.isMatchingSearch && !isSelected && 'resting-text',
          taskCardVariants({ status: task.status }),
          task.isMatchingSearch && (isFocused ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-green-300/20 hover:bg-green-300/30'),
        )}
      >
        <CardContent
          id={`${task.id}-content`}
          className={cn(
            'relative flex flex-col px-2.5! py-1.5 before:pointer-events-none before:absolute before:inset-y-0 before:left-px before:w-1 before:bg-primary before:opacity-0 sm:before:-left-px',
            isSheet ? 'group-focus-visible/task:before:opacity-100' : taskCardFocusBarClass,
            // The header's own py-1 makes up the rest, so opening a card leaves its buttons where the collapsed row had them
            !isSheet && effectiveState !== 'collapsed' && 'pt-0.5',
          )}
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
              className="z-10 data-[sticky=true]:-mx-2 data-[sticky=true]:bg-background/60 data-[sticky=true]:px-2 data-[sticky=true]:backdrop-blur-sm"
              enabled={!isSheet}
              offsetBottom={52}
            >
              <TaskCardHeader task={task} isSheet={isSheet} animateClose={hasToggled} showDragHandle={!isSheet && !isReadOnly} />
            </StickyBox>
          )}
          <CardDescriptionSlot
            task={task}
            state={effectiveState}
            isReadOnly={isReadOnly}
            animateClose={hasToggled}
            onEditRequest={isFocused && !isReadOnly ? startEditing : undefined}
          />
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
    </>
  );
});
