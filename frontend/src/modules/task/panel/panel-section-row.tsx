import { ChevronsRightLeftIcon, FunnelIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePanelToggle } from '~/modules/common/board/board-drag';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import type { SectionsValue } from '~/modules/task/board/task-board-store';
import { formatSectionLabel } from '~/modules/task/helpers/board-helpers';
import { cn } from '~/utils/cn';

interface PanelSectionRowProps {
  panelId: string;
  sectionFilters: SectionsValue;
  isCollapsed: boolean;
}

/** The row above a split section: it names the section's statuses, and a press collapses or expands it. */
export function PanelSectionRow({ panelId, sectionFilters, isCollapsed }: PanelSectionRowProps) {
  const { t } = useTranslation();
  const togglePanel = usePanelToggle();
  const label = formatSectionLabel(sectionFilters);

  const rowClass = cn(
    'group/row flex h-7 w-full shrink-0 items-center gap-1.5 border-x bg-card text-muted-foreground text-xs',
    isCollapsed ? 'justify-center' : 'px-2.5',
  );
  const content = (
    <>
      <FunnelIcon className="size-3 shrink-0" />
      {!isCollapsed && <span className={cn('min-w-0 truncate', hintFadeOut)}>{label}</span>}
    </>
  );

  if (!togglePanel) return <div className={rowClass}>{content}</div>;

  return (
    <button
      type="button"
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? t('c:expand_panel', { name: label }) : undefined}
      onClick={() => togglePanel(panelId)}
      className={cn(rowClass, 'focus-inset cursor-pointer hover:text-foreground')}
    >
      {content}
      {!isCollapsed && (
        <ChevronsRightLeftIcon className="ml-auto size-3 shrink-0 opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />
      )}
    </button>
  );
}
