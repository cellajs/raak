import { useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Grid2X2Icon, Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TKey } from '~/lib/i18n-locales';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { cn } from '~/utils/cn';

interface Props {
  className?: string;
}

function DisplayOptions({ className = '' }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();

  const isInPublicView = matchRoute({ to: '/$tenantId/$organizationSlug/public/project/$slug', fuzzy: true });
  const isInWorkspace = matchRoute({ to: '/$tenantId/$organizationSlug/workspace/$slug', fuzzy: true });

  // Determine which route we're on for search param extraction
  const fromRoute = isInPublicView
    ? ('/_public/_content/$tenantId/$organizationSlug/public/project/$slug' as const)
    : isInWorkspace
      ? ('/_app/$tenantId/$organizationSlug/workspace/$slug' as const)
      : ('/_app/$tenantId/$organizationSlug/project/$slug' as const);

  const { view = 'board' } = useSearch({ from: fromRoute }) as { view?: 'board' | 'table' };

  const currentValue = view || 'board';
  // Null means "not hovering": the tooltip and hover resets fall back to the live currentValue,
  // so a view change while unhovered can't leave a stale captured value behind.
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  const handleItemChange = (value: string | string[]) => {
    if (typeof value === 'string') {
      navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, view: value as 'board' | 'table' }) });
    }
  };

  return (
    <TooltipButton toolTipContent={t(`c:${hoveredValue ?? currentValue}_view` as TKey)}>
      <ToggleGroup
        type="single"
        variant="merged"
        className={cn('gap-0', className)}
        value={currentValue}
        onValueChange={handleItemChange}
      >
        {['board', 'table'].map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            onMouseEnter={() => setHoveredValue(value)}
            onMouseLeave={() => setHoveredValue(null)}
            onFocus={() => setHoveredValue(value)}
            onBlur={() => setHoveredValue(null)}
          >
            {value === 'board' && <SquareKanbanIcon />}
            {value === 'table' && <Rows4Icon />}
            {value === 'overview' && <Grid2X2Icon />}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </TooltipButton>
  );
}

export { DisplayOptions };
