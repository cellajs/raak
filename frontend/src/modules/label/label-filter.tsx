import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

/**
 * Toggles the board search's '=' highlight query for a label.
 * Matching tasks and label tiles are tinted; toggling the same name clears the query.
 */
const useLabelFilterToggle = () => {
  const { search, setSearch } = useSearchParams<{ q?: string }>({});
  const activeFilter = search.q ?? '';

  return {
    activeFilter,
    isActive: (name: string) => activeFilter === `=${name}`,
    toggle: (name: string) => setSearch({ q: activeFilter === `=${name}` ? '' : `=${name}` }),
  };
};

interface LabelFilterButtonProps {
  name: string;
  size?: 'xs' | 'icon';
  className?: string;
  onToggle?: () => void;
}

/** Toggle button for highlighting a label across the board from its tile. */
export function LabelFilterButton({ name, size = 'icon', className, onToggle }: LabelFilterButtonProps) {
  const { t } = useTranslation();
  const { isActive, toggle } = useLabelFilterToggle();
  const label = t('c:filter_by_resource', { resource: name });

  return (
    <TooltipButton toolTipContent={label} side="top" sideOffset={5}>
      <Button
        variant="ghost"
        size={size}
        aria-label={label}
        aria-pressed={isActive(name)}
        onClick={() => {
          toggle(name);
          onToggle?.();
        }}
        className={cn('opacity-60 hover:opacity-100', isActive(name) && 'text-primary opacity-100', className)}
      >
        <ListFilterIcon />
      </Button>
    </TooltipButton>
  );
}
