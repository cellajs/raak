import type { ReactNode } from 'react';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

// The icon inside the frame stays on collapse, so the frame fades by color: opacity would take the icon along
const frameBorderFade = tw('border-border/[calc(var(--content-opacity,1)*100%)]');

interface LocalPanelShellProps {
  /** Stable persisted panel id (collapse/size/order state key). */
  panelId: string;
  icon: ReactNode;
  title: string;
  headerActions?: ReactNode;
  /** When true, panel fills the board row and grows with content (no fixed viewport height) */
  windowScroll?: boolean;
  /** Fills the panel below its handle while collapsed. */
  collapsedContent?: ReactNode;
  children: ReactNode;
}

/**
 * Frame for the local board panels (explainer, labels): a collapsed icon handle, or a pinned header with
 * drag handle, title and actions above the body. Collapse, size and order persist per `panelId`.
 */
export function LocalPanelShell({ panelId, icon, title, headerActions, windowScroll, collapsedContent, children }: LocalPanelShellProps) {
  const isCollapsed = !!useBoardStore((state) => state.panelCollapseState[panelId]);

  // One tree for both states, so the handle stays the same element and keeps focus through a collapse or expand
  return (
    <BoardPanelBody
      windowScroll={windowScroll}
      className={cn(
        'rounded-lg rounded-b-none',
        isCollapsed ? 'sm:border-0' : frameBorderFade,
        // The header renders inside this frame, so it also spans the board header row
        // (smaller offset than project panel bodies, which sit below their header).
        windowScroll ? 'h-full' : 'sm:h-[calc(100dvh-var(--local-panel-offset))]',
      )}
    >
      <div
        className={cn(
          'flex min-h-13 items-center',
          isCollapsed
            ? 'justify-center'
            : ['gap-2 truncate border-b bg-card/[calc(var(--content-opacity,1)*100%)] px-2 font-semibold text-sm', frameBorderFade],
        )}
      >
        <PanelDragHandleButton
          name={title}
          fallbackLabel={title}
          icon={icon}
          // Collapsed, the panel clips its overflow, so the handle stays a collapsed avatar's size to keep its focus ring in view
          className={isCollapsed ? 'size-8 p-0 hover:bg-transparent' : 'h-8 truncate p-2 hover:bg-transparent'}
        >
          {!isCollapsed && title}
        </PanelDragHandleButton>
        {!isCollapsed && headerActions && <div className={cn('ml-auto', hintFadeOut)}>{headerActions}</div>}
      </div>
      {isCollapsed ? collapsedContent : <div className={cn('flex min-h-0 flex-1 flex-col', hintFadeOut)}>{children}</div>}
    </BoardPanelBody>
  );
}
