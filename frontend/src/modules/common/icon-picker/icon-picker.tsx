import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import lucideIcons from '~/modules/common/icons/lucide-icons.gen.json';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { Input } from '~/modules/ui/input';
import { cn } from '~/utils/cn';

/** Rendering cap per search state; the full set is reachable by narrowing the query. */
const maxVisible = 96;

const allIconNames = Object.keys(lucideIcons);
const searchIndex = lucideIcons as Record<string, string[]>;

interface IconPickerProps {
  /** Currently selected lucide icon name, if any */
  value?: string | null;
  onChange: (name: string) => void;
  className?: string;
}

/**
 * Searchable grid over the full lucide icon set (sprite-rendered), for user-selectable
 * entity icons. Matches on name and lucide tag synonyms. Import lazily; the search index
 * is bundled into this chunk.
 */
export const IconPicker = ({ value, onChange, className }: IconPickerProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allIconNames;
    return allIconNames.filter((name) => name.includes(q) || searchIndex[name].some((tag) => tag.includes(q)));
  }, [query]);

  return (
    <div className={cn('flex w-72 flex-col gap-2', className)}>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('c:search')} autoFocus />
      {matches.length === 0 && <span className="p-2 text-muted-foreground text-sm">{t('c:no_results')}</span>}
      <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto" role="listbox" aria-label={t('c:search')}>
        {matches.slice(0, maxVisible).map((name) => (
          <button
            key={name}
            type="button"
            role="option"
            aria-selected={name === value}
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              'flex items-center justify-center rounded-md p-1.5 hover:bg-accent',
              name === value && 'bg-accent ring-1 ring-ring',
            )}
          >
            <SpriteIcon name={name} className="icon-lg" />
          </button>
        ))}
      </div>
      {matches.length > maxVisible && (
        <span className="px-1 text-muted-foreground text-xs">{`${matches.length - maxVisible}+`}</span>
      )}
    </div>
  );
};
