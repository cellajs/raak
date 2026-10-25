import { Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { ViewToggle, type ViewToggleMode } from '~/modules/common/view-toggle';

const modes: readonly ViewToggleMode<'board' | 'table'>[] = [
  { value: 'board', icon: SquareKanbanIcon, label: 'c:board_view' },
  { value: 'table', icon: Rows4Icon, label: 'c:table_view' },
];

interface DisplayOptionsProps {
  className?: string;
}

export function DisplayOptions({ className }: DisplayOptionsProps) {
  return <ViewToggle modes={modes} className={className} />;
}
