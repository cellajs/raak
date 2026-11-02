import { useNavigate, useSearch } from '@tanstack/react-router';
import { Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInDropdownerDrawer } from '~/modules/common/dropdowner/drawer';
import { DropdownSegmented } from '~/modules/common/dropdowner/dropdown-segmented';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { ViewToggle, type ViewToggleMode } from '~/modules/common/view-toggle';

type TaskView = 'board' | 'table';

const modes: readonly ViewToggleMode<TaskView>[] = [
  { value: 'board', icon: SquareKanbanIcon, label: 'c:board_view' },
  { value: 'table', icon: Rows4Icon, label: 'c:table_view' },
];

interface DisplayOptionsProps {
  className?: string;
}

export function DisplayOptions({ className }: DisplayOptionsProps) {
  return <ViewToggle modes={modes} className={className} />;
}

/** The same choice on top of a board's phone menu, whose bar has no room for the toggle. */
export function DrawerDisplayOptions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inDrawer = useInDropdownerDrawer();
  const view = useSearch({ strict: false, select: (search) => search.view });

  if (!inDrawer) return null;

  const changeView = (next: TaskView) => {
    dropdowner.getState().remove();
    navigate({ to: '.', resetScroll: false, search: (prev) => ({ ...prev, view: next }) });
  };

  return (
    <DropdownSegmented<TaskView>
      label={t('c:view_mode')}
      value={view === 'table' ? 'table' : 'board'}
      onChange={changeView}
      options={modes.map(({ value, label }) => ({ value, label: t(label) }))}
    />
  );
}
