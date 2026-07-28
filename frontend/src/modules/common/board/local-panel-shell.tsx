import type { ReactNode } from 'react';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { cn } from '~/utils/cn';

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
export const LocalPanelShell = ({
  panelId,
  icon,
  title,
  headerActions,
  windowScroll,
  children,
}: LocalPanelShellProps) => {
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  return (
    <BoardPanelContent
      isCollapsed={!!isCollapsed}
      collapsedContent={
        <PanelDragHandleButton
          name={title}
          fallbackLabel={title}
          icon={icon}
          className="flex h-auto min-h-13 w-12.5 items-center justify-center p-0 hover:bg-transparent"
        />
      }
    >
      <BoardPanelBody
        windowScroll={windowScroll}
        className={cn(
          'rounded-md rounded-b-none',
          // The header renders inside this frame, so it also spans the board header row
          // (smaller offset than project panel bodies, which sit below their header).
          windowScroll ? 'h-full' : 'sm:h-[calc(100vh-var(--local-panel-offset))]',
        )}
      >
        <div className="flex min-h-13 items-center justify-between gap-2 truncate border-b bg-card px-2 font-semibold text-sm">
          <PanelDragHandleButton
            name={title}
            fallbackLabel={title}
            icon={icon}
            className="flex h-8 items-center gap-2 truncate p-2 hover:bg-transparent"
          >
            <div className="truncate">{title}</div>
          </PanelDragHandleButton>
          <div className="grow" />
          {headerActions}
        </div>
        {children}
      </BoardPanelBody>
    </BoardPanelContent>
  );
};
