import { FunnelIcon } from 'lucide-react';
import type { SectionsValue } from '~/modules/task/board/task-board-store';
import { formatSectionLabel } from '~/modules/task/helpers/board-helpers';

/** The row above a split section: it names the section's statuses. */
export function PanelSectionRow({ sectionFilters }: { sectionFilters: SectionsValue }) {
  return (
    <div className="flex h-7 w-full shrink-0 items-center gap-1.5 border-x bg-card px-2.5 text-muted-foreground text-xs">
      <FunnelIcon className="size-3 shrink-0" />
      <span className="min-w-0 truncate">{formatSectionLabel(sectionFilters)}</span>
    </div>
  );
}
