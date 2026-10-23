import { CollapsedPanelView, type CollapsedSection } from '~/modules/common/board/board-panel';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';
import { cn } from '~/utils/cn';

/** Tasks the collapsed panel counts in its middle: everything outside the accepted and iced sections. */
export const collapsedMainCount = (counts: TaskCounts) => counts.total - counts.iced - counts.accepted;

interface TaskPanelCollapsedProps {
  counts: TaskCounts;
}

/**
 * Task-specific collapsed panel mapping TaskCounts to the generic CollapsedPanelView.
 */
export function TaskPanelCollapsed({ counts }: TaskPanelCollapsedProps) {
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

  return <CollapsedPanelView mainCount={collapsedMainCount(counts)} sections={sections} />;
}
