import type { CollapsedSection } from '~/modules/common/board/board-panel';
import { CollapsedPanelStrip } from '~/modules/task/panel/collapsed-panel-strip';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';
import { cn } from '~/utils/cn';

/** Tasks the collapsed panel counts in its middle: everything outside the accepted and iced sections. */
export const collapsedMainCount = (counts: TaskCounts) => counts.total - counts.iced - counts.accepted;

interface TaskPanelCollapsedProps {
  panelId: string;
  name: string;
  counts: TaskCounts;
}

export function TaskPanelCollapsed({ panelId, name, counts }: TaskPanelCollapsedProps) {
  const sections: CollapsedSection[] = [];

  if (counts.showAccepted) {
    sections.push({
      count: counts.accepted,
      colorClass: cn(statusSectionColors.accepted.fill, statusSectionColors.accepted.text),
      borderClass: statusSectionColors.accepted.border,
      position: 'top',
    });
  }

  if (counts.showIced) {
    sections.push({
      count: counts.iced,
      colorClass: cn(statusSectionColors.iced.fill, statusSectionColors.iced.text),
      borderClass: statusSectionColors.iced.border,
      position: 'bottom',
    });
  }

  return <CollapsedPanelStrip panelId={panelId} name={name} mainCount={collapsedMainCount(counts)} sections={sections} />;
}
