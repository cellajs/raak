import { CollapsedPanelView, type CollapsedSection } from '~/modules/common/board/board-panel';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';

/** Tasks the collapsed panel counts in its middle: everything outside the accepted and iced sections. */
export const collapsedMainCount = (counts: TaskCounts) => counts.total - counts.iced - counts.accepted;

/**
 * Task-specific collapsed panel mapping TaskCounts to the generic CollapsedPanelView.
 */
export function TaskPanelCollapsed({ counts }: { counts: TaskCounts }) {
  const sections: CollapsedSection[] = [];

  if (counts.showAccepted) {
    sections.push({
      count: counts.accepted,
      colorClass: `${statusSectionColors.accepted.fill} ${statusSectionColors.accepted.text}`,
      borderClass: statusSectionColors.accepted.border,
      position: 'top',
    });
  }

  if (counts.showIced) {
    sections.push({
      count: counts.iced,
      colorClass: `${statusSectionColors.iced.fill} ${statusSectionColors.iced.text}`,
      borderClass: statusSectionColors.iced.border,
      position: 'bottom',
    });
  }

  return <CollapsedPanelView mainCount={collapsedMainCount(counts)} sections={sections} />;
}
