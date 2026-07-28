import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

/**
 * Toggles the board search's '=' highlight query for a label.
 * Matching tasks and label tiles are tinted; toggling the same name clears the query.
 */
export const useLabelFilterToggle = () => {
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
  tabIndex?: number;
  className?: string;
}

/** Toggle button for highlighting a label across the board (label tile + label page). */
export function LabelFilterButton({ name, size = 'icon', tabIndex, className }: LabelFilterButtonProps) {
  const { t } = useTranslation();
  const { isActive, toggle } = useLabelFilterToggle();

  return (
    <Button
      variant="ghost"
      size={size}
      tabIndex={tabIndex}
      aria-label={t('c:filter_by_resource', { resource: name })}
      aria-pressed={isActive(name)}
      onClick={(event) => {
        // Rendered inside the tile's Link: the toggle must not navigate to the label page
        event.preventDefault();
        event.stopPropagation();
        toggle(name);
      }}
      className={cn('opacity-60 hover:opacity-100', isActive(name) && 'text-primary opacity-100', className)}
    >
      <ListFilterIcon />
    </Button>
  );
}
