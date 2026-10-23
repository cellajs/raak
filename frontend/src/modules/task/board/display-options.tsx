import { useNavigate, useSearch } from '@tanstack/react-router';
import { Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { cn } from '~/utils/cn';

const views = ['board', 'table'] as const;

interface Props {
  className?: string;
}

function DisplayOptions({ className = '' }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Nearest match, not a route picked with matchRoute: while a navigation commits, matchRoute still tests the page being left.
  const currentValue = useSearch({ strict: false, select: (search) => search.view }) ?? 'board';
  // Null means "not hovering": the tooltip and hover resets fall back to the live currentValue,
  // so a view change while unhovered can't leave a stale captured value behind.
  const [hoveredValue, setHoveredValue] = useState<(typeof views)[number] | null>(null);

  const handleItemChange = (value: string | string[]) => {
    if (value === 'board' || value === 'table') navigate({ to: '.', search: (prev) => ({ ...prev, view: value }) });
  };

  return (
    <TooltipButton toolTipContent={t(`c:${hoveredValue ?? currentValue}_view`)}>
      <ToggleGroup type="single" variant="merged" className={cn('gap-0', className)} value={currentValue} onValueChange={handleItemChange}>
        {views.map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={t(`c:${value}_view`)}
            onMouseEnter={() => setHoveredValue(value)}
            onMouseLeave={() => setHoveredValue(null)}
            onFocus={() => setHoveredValue(value)}
            onBlur={() => setHoveredValue(null)}
          >
            {value === 'board' && <SquareKanbanIcon />}
            {value === 'table' && <Rows4Icon />}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </TooltipButton>
  );
}

export { DisplayOptions };
