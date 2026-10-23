import { useNavigate, useSearch } from '@tanstack/react-router';
import { Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { cn } from '~/utils/cn';

const views = ['board', 'table'] as const;

interface DisplayOptionsProps {
  className?: string;
}

export function DisplayOptions({ className = '' }: DisplayOptionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const currentView = useSearch({ strict: false, select: (search) => search.view }) ?? 'board';
  // Null means not hovering: the tooltip falls back to the live currentView,
  // so a view change while unhovered leaves no stale captured value.
  const [hoveredView, setHoveredView] = useState<(typeof views)[number] | null>(null);

  const handleViewChange = (value: string | string[]) => {
    if (value === 'board' || value === 'table') navigate({ to: '.', search: (prev) => ({ ...prev, view: value }) });
  };

  return (
    <TooltipButton toolTipContent={t(`c:${hoveredView ?? currentView}_view`)}>
      <ToggleGroup type="single" variant="merged" className={cn('gap-0', className)} value={currentView} onValueChange={handleViewChange}>
        {views.map((view) => (
          <ToggleGroupItem
            key={view}
            value={view}
            aria-label={t(`c:${view}_view`)}
            onMouseEnter={() => setHoveredView(view)}
            onMouseLeave={() => setHoveredView(null)}
            onFocus={() => setHoveredView(view)}
            onBlur={() => setHoveredView(null)}
          >
            {view === 'board' && <SquareKanbanIcon />}
            {view === 'table' && <Rows4Icon />}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </TooltipButton>
  );
}
