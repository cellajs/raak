import { useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Grid2X2Icon, Rows4Icon, SquareKanbanIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { cn } from '~/utils/cn';

interface Props {
  className?: string;
}

const DisplayOptions = ({ className = '' }: Props) => {
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
  const [hoveredValue, setHoveredValue] = useState<string | null>(currentValue || null);

  const handleItemChange = (value: string | string[]) => {
    if (typeof value === 'string') {
      navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, view: value as 'board' | 'table' }) });
    }
  };

  return (
    <TooltipButton toolTipContent={t(`c:${hoveredValue}_view`)}>
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
            onMouseLeave={() => setHoveredValue(currentValue)}
            onFocus={() => setHoveredValue(value)}
            onBlur={() => setHoveredValue(currentValue)}
          >
            {value === 'board' && <SquareKanbanIcon size={16} />}
            {value === 'table' && <Rows4Icon size={16} />}
            {value === 'overview' && <Grid2X2Icon size={16} />}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </TooltipButton>
  );
};

export default DisplayOptions;
