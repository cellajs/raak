import { SquareCheckBigIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { formatStatusesLabel, listStatusNames } from '~/modules/task/helpers/board-helpers';
import { statusOptionsByValue, type TaskStatus } from '~/modules/task/task-properties';

function StatusIcons({ statuses }: { statuses: TaskStatus[] }) {
  const icons = statuses.map((status) => {
    const { icon: Icon } = statusOptionsByValue[status];
    // The tooltip names them all, so no svg title of one on top of it
    return <Icon key={status} className="pointer-events-none size-4 shrink-0 rounded-md bg-card ring-1 ring-card" />;
  });
  if (statuses.length < 2) return icons;

  return (
    <TooltipButton toolTipContent={listStatusNames(statuses)}>
      <span className="flex -space-x-1">{icons}</span>
    </TooltipButton>
  );
}

interface PanelStatusIconProps {
  statuses?: TaskStatus[];
  isCollapsed: boolean;
}

/** A project page panel's icon: its statuses, overlapping when there are several. A collapsed strip has no room for those. */
export function PanelStatusIcon({ statuses, isCollapsed }: PanelStatusIconProps) {
  const showsStatuses = statuses && (statuses.length === 1 || !isCollapsed);

  return (
    <div className="flex min-w-8 justify-center">
      {showsStatuses ? <StatusIcons statuses={statuses} /> : <SquareCheckBigIcon className="size-4 shrink-0" />}
    </div>
  );
}

interface PanelStatusTitleProps {
  statuses?: TaskStatus[];
  count?: number;
}

/** A project page panel's title: "Tasks" with all statuses in it, else the statuses it lists and their tasks. */
export function PanelStatusTitle({ statuses, count }: PanelStatusTitleProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <div className="truncate font-semibold leading-6">{statuses ? formatStatusesLabel(statuses) : t('c:task_other')}</div>
      {statuses && count !== undefined && <span className="text-muted-foreground text-sm tabular-nums">{count}</span>}
    </div>
  );
}
