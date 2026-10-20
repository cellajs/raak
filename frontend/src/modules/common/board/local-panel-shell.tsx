import type { ReactNode } from 'react';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import { cn } from '~/utils/cn';

// The icon inside the frame stays on collapse, so the frame fades by color: opacity would take the icon along
const frameBorderFade = 'border-border/[calc(var(--content-opacity,1)*100%)]';

interface LocalPanelShellProps {
  /** Stable persisted panel id (collapse/size/order state key). */
  panelId: string;
  icon: ReactNode;
  title: string;
  headerActions?: ReactNode;
  /** When true, panel fills the board row and grows with content (no fixed viewport height) */
  windowScroll?: boolean;
  children: ReactNode;
}

/**
 * Frame for local (non-project) board panels such as the explainer and the labels panel:
 * collapsed icon handle, pinned header with drag handle + title + optional actions, and a
 * body slot. Collapse/resize/drag persistence rides the generic panel stores via panelId.
 */
export function LocalPanelShell({ panelId, icon, title, headerActions, windowScroll, children }: LocalPanelShellProps) {
  const isCollapsed = !!useBoardStore((state) => state.panelCollapseState[panelId]);

  // One tree for both states, so the handle stays the same element and keeps focus through a collapse or expand
  return (
    <BoardPanelBody
      windowScroll={windowScroll}
      className={cn(
        'rounded-md rounded-b-none',
        isCollapsed ? 'sm:border-0' : frameBorderFade,
        // The header renders inside this frame, so it also spans the board header row
        // (smaller offset than project panel bodies, which sit below their header).
        windowScroll ? 'h-full' : 'sm:h-[calc(100vh-var(--local-panel-offset))]',
      )}
    >
      <div
        className={cn(
          'flex min-h-13 items-center',
          isCollapsed
            ? 'justify-center'
            : ['justify-between gap-2 truncate border-b bg-card/[calc(var(--content-opacity,1)*100%)] px-2 font-semibold text-sm', frameBorderFade],
        )}
      >
        <PanelDragHandleButton
          name={title}
          fallbackLabel={title}
          icon={icon}
          // Collapsed, the panel clips its overflow, so the handle stays a collapsed avatar's size to keep its focus ring in view
          className={isCollapsed ? 'size-8 p-0 hover:bg-transparent' : 'flex h-8 items-center gap-2 truncate p-2 hover:bg-transparent'}
        >
          {!isCollapsed && <div className="truncate">{title}</div>}
        </PanelDragHandleButton>
        {!isCollapsed && headerActions && <div className={cn('ml-auto', hintFadeOut)}>{headerActions}</div>}
      </div>
      {!isCollapsed && <div className={cn('flex min-h-0 flex-1 flex-col', hintFadeOut)}>{children}</div>}
    </BoardPanelBody>
  );
}
