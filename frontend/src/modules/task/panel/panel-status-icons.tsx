import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { statusOptionsByValue, type TaskStatus } from '~/modules/task/task-properties';

/** A project page panel's mark: the furthest of its statuses on top, the others below it in flow order. */
export function PanelStatusIcons({ statuses }: { statuses: TaskStatus[] }) {
  const { t } = useTranslation();

  const icons = statuses.map((status) => {
    const { icon: Icon } = statusOptionsByValue[status];
    // The tooltip names them all, so no svg title of one on top of it
    return <Icon key={status} className="bg-card ring-card pointer-events-none size-4 shrink-0 rounded-full ring-1" />;
  });
  if (icons.length < 2) return <span className="flex min-w-8 justify-center">{icons}</span>;

  // Two rows fit a collapsed panel's 50px and the header's height alike, so the mark keeps its shape when the panel folds
  return (
    <span className="flex min-w-8 justify-center">
      <TooltipButton toolTipContent={statuses.map((status) => t(`c:${statusOptionsByValue[status].name}`)).join(', ')}>
        <span className="flex flex-col items-center -space-y-1">
          <span className="flex">{icons.at(-1)}</span>
          <span className="flex -space-x-1">{icons.slice(0, -1)}</span>
        </span>
      </TooltipButton>
    </span>
  );
}
