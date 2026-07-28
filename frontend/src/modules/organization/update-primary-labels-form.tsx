import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TagIcon, Trash2Icon } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { labelSlug, type PrimaryLabelDefinition, primaryLabelLimits } from 'shared';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { Spinner } from '~/modules/common/spinner';
import { toaster } from '~/modules/common/toaster/toaster';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { useOrganizationUpdateMutation } from '~/modules/organization/query';
import { Button, SubmitButton } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { cn } from '~/utils/cn';

const IconPicker = lazy(() =>
  import('~/modules/common/icon-picker/icon-picker').then((m) => ({ default: m.IconPicker })),
);

interface Props {
  organization: Organization;
}

/**
 * Manages the organization's primary label set (setupConfig.primaryLabels): the task types
 * provisioned into every new project. Slugs are derived from the name on add and stay stable
 * afterwards, since they are the identity that organization tracking matches on.
 */
export function UpdatePrimaryLabelsForm({ organization }: Props) {
  const { t } = useTranslation();
  const { mutate, isPending } = useOrganizationUpdateMutation();
  const [entries, setEntries] = useState<PrimaryLabelDefinition[]>(organization.setupConfig.primaryLabels);
  const [isDirty, setIsDirty] = useState(false);

  const update = (next: PrimaryLabelDefinition[]) => {
    setEntries(next);
    setIsDirty(true);
  };

  const patchEntry = (index: number, patch: Partial<PrimaryLabelDefinition>) =>
    update(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const move = (index: number, delta: -1 | 1) => {
    const next = [...entries];
    const [entry] = next.splice(index, 1);
    next.splice(index + delta, 0, entry);
    update(next);
  };

  const addEntry = () => {
    const name = t('c:label');
    const slugBase = labelSlug(name) || 'label';
    // Slugs are identity: suffix until unique within the set
    let slug = slugBase;
    for (let i = 2; entries.some((e) => e.slug === slug); i++) slug = `${slugBase}-${i}`;
    update([...entries, { slug, name, color: 'blue', icon: null }]);
  };

  const onSave = () => {
    const names = entries.map((e) => e.name.trim());
    if (names.some((name) => !name)) return;
    mutate(
      {
        path: { tenantId: organization.tenantId, id: organization.id },
        body: { setupConfig: { primaryLabels: entries } },
      },
      {
        onSuccess: (updated) => {
          setEntries(updated.setupConfig.primaryLabels);
          setIsDirty(false);
          toaster.success(t('c:success.update_resource', { resource: t('c:organization') }));
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('c:primary_labels.text')}</p>
      {entries.map((entry, index) => (
        <div key={entry.slug} className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="icon" aria-label={t('c:icon')} />}>
              {entry.icon ? (
                <SpriteIcon
                  name={entry.icon}
                  className={cn('icon-md', isLabelColorToken(entry.color) && labelPalette[entry.color].icon)}
                />
              ) : (
                <TagIcon className="icon-md opacity-50" />
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <Suspense fallback={<Spinner />}>
                <IconPicker value={entry.icon} onChange={(icon) => patchEntry(index, { icon })} />
              </Suspense>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="icon" aria-label={t('c:color')} />}>
              <span
                className={cn(
                  'size-4 rounded-full',
                  isLabelColorToken(entry.color) ? labelPalette[entry.color].dot : 'bg-muted',
                )}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-7 gap-1">
                {Object.entries(labelPalette).map(([token, palette]) => (
                  <button
                    key={token}
                    type="button"
                    title={token}
                    aria-label={token}
                    onClick={() => patchEntry(index, { color: token as PrimaryLabelDefinition['color'] })}
                    className={cn(
                      'flex items-center justify-center rounded-md p-1.5 hover:bg-accent',
                      entry.color === token && 'bg-accent ring-1 ring-ring',
                    )}
                  >
                    <span className={cn('size-4 rounded-full', palette.dot)} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            value={entry.name}
            onChange={(event) => patchEntry(index, { name: event.target.value })}
            className="max-w-56"
            required
          />

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('c:move_up')}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            <ArrowUpIcon className="icon-sm" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('c:move_down')}
            disabled={index === entries.length - 1}
            onClick={() => move(index, 1)}
          >
            <ArrowDownIcon className="icon-sm" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('c:remove')}
            disabled={entries.length <= primaryLabelLimits.min}
            onClick={() => update(entries.filter((_, i) => i !== index))}
          >
            <Trash2Icon className="icon-sm" />
          </Button>
        </div>
      ))}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button variant="outline" size="sm" disabled={entries.length >= primaryLabelLimits.max} onClick={addEntry}>
          <PlusIcon className="icon-sm" />
          {t('c:add')}
        </Button>
        <SubmitButton disabled={!isDirty} loading={isPending} onClick={onSave}>
          {t('c:save_changes')}
        </SubmitButton>
      </div>
    </div>
  );
}
