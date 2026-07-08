import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelDragHandle } from '~/modules/common/board/board-drag';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface PanelDragHandleButtonProps {
  /** Sortable name announced by screen readers (e.g. the project or section name). */
  name: string;
  /** aria-label when the board isn't reorderable (no drag handle). Omit to leave it unlabeled. */
  fallbackLabel?: string;
  /** Per-panel layout classes (collapsed vs expanded shape). */
  className?: string;
  children: ReactNode;
}

/**
 * A panel header / collapsed-slot button wired as a keyboard-accessible drag handle.
 * Consumes the board's drag context (null when the board isn't reorderable) and applies the
 * shared grab-cursor + sortable ARIA. Per-panel layout is supplied via `className`.
 */
export const PanelDragHandleButton = ({ name, fallbackLabel, className, children }: PanelDragHandleButtonProps) => {
  const { t } = useTranslation();
  const panelDrag = usePanelDragHandle();

  return (
    <Button
      type="button"
      variant="ghost"
      ref={panelDrag?.registerHandle}
      className={cn(className, panelDrag && 'cursor-grab active:cursor-grabbing')}
      aria-roledescription={panelDrag ? t('c:sortable') : undefined}
      aria-label={
        panelDrag
          ? t('c:sortable_position', { name, position: panelDrag.index + 1, total: panelDrag.total })
          : fallbackLabel
      }
      onKeyDown={panelDrag?.onKeyDown}
      onClick={panelDrag?.onToggleCollapsed}
    >
      {children}
    </Button>
  );
};
