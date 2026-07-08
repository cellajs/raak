import { CollapsedPanelView, type CollapsedSection } from '~/modules/common/board/board-panel';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';

/**
 * Task-specific collapsed panel mapping TaskCounts to the generic CollapsedPanelView.
 */
export const TaskPanelCollapsed = ({ counts }: { counts: TaskCounts }) => {
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

  const mainCount = counts.total - counts.iced - counts.accepted;

  return <CollapsedPanelView mainCount={mainCount} sections={sections} />;
};
