import type { ReactNode } from 'react';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/task/panel/panel-drag-handle-button';

interface LocalPanelShellProps {
  /** Stable persisted panel id (collapse/size/order state key). */
  panelId: string;
  icon: ReactNode;
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Frame for local (non-project) board panels such as the explainer and the labels panel:
 * collapsed icon handle, pinned header with drag handle + title + optional actions, and a
 * body slot. Collapse/resize/drag persistence rides the generic panel stores via panelId.
 */
export const LocalPanelShell = ({ panelId, icon, title, headerActions, children }: LocalPanelShellProps) => {
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  return (
    <BoardPanelContent
      isCollapsed={!!isCollapsed}
      collapsedContent={
        <PanelDragHandleButton
          name={title}
          fallbackLabel={title}
          className="flex h-auto min-h-13 w-12.5 items-center justify-center p-0 hover:bg-transparent"
        >
          {icon}
        </PanelDragHandleButton>
      }
    >
      <div className="relative flex max-w-full flex-1 shrink-0 snap-center flex-col rounded-md rounded-b-none bg-transparent sm:h-[calc(100vh-78px)] sm:border">
        <div className="flex min-h-13 items-center justify-between gap-2 truncate border-b bg-card px-2 font-semibold text-sm">
          <PanelDragHandleButton
            name={title}
            fallbackLabel={title}
            className="flex h-8 items-center gap-2 truncate p-2 hover:bg-transparent"
          >
            {icon}
            <div className="truncate">{title}</div>
          </PanelDragHandleButton>
          <div className="grow" />
          {headerActions}
        </div>
        {children}
      </div>
    </BoardPanelContent>
  );
};
