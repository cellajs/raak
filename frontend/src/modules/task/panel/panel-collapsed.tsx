import { CollapsedPanelView, type CollapsedSection } from '~/modules/common/board/board-panel';
import type { TaskCounts } from '~/modules/task/types';

/**
 * Task-specific collapsed panel — maps TaskCounts to the generic CollapsedPanelView.
 */
export const TaskPanelCollapsed = ({ counts }: { counts: TaskCounts }) => {
  const sections: CollapsedSection[] = [];

  if (typeof counts.accepted === 'number') {
    sections.push({
      count: counts.accepted,
      colorClass: 'bg-green-500/5 text-green-500',
      borderClass: 'border-b border-b-green-500/10',
      position: 'top',
    });
  }

  if (typeof counts.iced === 'number') {
    sections.push({
      count: counts.iced,
      colorClass: 'bg-sky-500/5 text-sky-500',
      borderClass: 'border-t border-t-sky-500/10',
      position: 'bottom',
    });
  }

  const mainCount = counts.total - (counts.iced || 0) - (counts.accepted || 0);

  return <CollapsedPanelView mainCount={mainCount} sections={sections} />;
};
