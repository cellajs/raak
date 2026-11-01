import type { CollapsedSection } from '~/modules/common/board/board-panel';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { foldsSection } from '~/modules/task/helpers/board-helpers';
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
  const section = (type: TogglableStatusType, position: CollapsedSection['position']): CollapsedSection[] => {
    if (!foldsSection(type, counts)) return [];
    const { fill, text, border } = statusSectionColors[type];
    return [{ count: counts[type], colorClass: cn(fill, text), borderClass: border[position], position }];
  };
  const sections = [...section('accepted', 'top'), ...section('iced', 'bottom')];

  return <CollapsedPanelStrip panelId={panelId} name={name} mainCount={collapsedMainCount(counts)} sections={sections} />;
}
