import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { useMatch } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, FlagIcon, TagIcon } from 'lucide-react';
import { type CSSProperties, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zLabel } from 'sdk/zod.gen';
import { labelSlug } from 'shared/config/labels-config';
import { generateId } from 'shared/utils/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { ComboboxSearchInput } from '~/modules/common/combobox-search-input';
import { deduplicateLabels } from '~/modules/label/group-labels';
import { useLabelRecencyStore } from '~/modules/label/label-recency-store';
import { type Label, labelsCanonicalOptions, useLabelCreateMutation } from '~/modules/label/query';
import { useLabelUsage } from '~/modules/label/use-label-usage';
import { projectsListQueryOptions } from '~/modules/project/query';
import {
  ComboboxHotkeyHint,
  comboboxActionButtonClass,
  comboboxInputPinClass,
  comboboxRowClass,
  comboboxScrollClass,
  comboboxShellClass,
  HotkeyIndexBadge,
  matchDigitHotkey,
} from '~/modules/task/dropdowns/combobox-parts';
import type { SelectLabelsProps } from '~/modules/task/dropdowns/types';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { useLiveSelection } from '~/modules/task/hooks/use-live-selection';
import type { TaskLabel } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { Combobox, ComboboxGroup, ComboboxGroupLabel, ComboboxItem, ComboboxList } from '~/modules/ui/combobox';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { coalescedResult } from '~/query/offline/prepared-mutation';
import { cn } from '~/utils/cn';
import { isTouchInteraction } from '~/utils/input-modality';

// Prefix of the create row's value, so it cannot collide with a real label name in onValueChange.
const createSentinelPrefix = '__create__';

/** Suggested labels shown without a search; the digit hotkeys cover the same range. */
const suggestedLabelCount = 8;

const labelColors = [
  '#A8E6CF',
  '#D0F0FD',
  '#D7CFF7',
  '#FFE0B2',
  '#FADADD',
  '#FF6F61',
  '#1DE9B6',
  '#FFD54F',
  '#40C4FF',
  '#B388FF',
  '#374785',
  '#2E7D32',
  '#D84315',
  '#546E7A',
  '#6A1B9A',
  '#00B8D4',
  '#5C6BC0',
  '#B2DFDB',
  '#CFD8DC',
  '#4A90E2',
];

// The picker offers secondary tags and epics; primary labels have dedicated task-card UI.
// Module-level so `labels` keeps its identity between renders and the compiler's memoization of what derives from it holds.
const combineTaskLabels = (results: { data?: { items: Label[] } }[]): Label[] =>
  results.flatMap((result) => result.data?.items ?? []).filter((label) => label.mode !== 'primary');

export function SelectLabels({ value: currentLabels, projectId, onChange, taskId, triggerWidth = 320, initialSelectedCollapsed }: SelectLabelsProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const workspaceId = useMatch({
    from: '/_app/$tenantId/$organizationSlug/workspace/$slug',
    shouldThrow: false,
    select: (match) => match.context.workspace?.id,
  });

  // Subscribed so labels re-scope when the list updates; in a workspace the board has already fetched it.
  const { data: workspaceProjectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspaceId ?? '' }),
    enabled: !!workspaceId,
    select: (data) => data.pages.flatMap((page) => page.items.map((project) => project.id)),
  });

  // Labels are project-homed: inside a workspace span its projects, else the current one (also until the project list has loaded).
  const labelProjectIds = workspaceId && workspaceProjectIds ? workspaceProjectIds : [projectId];

  const labels = useQueries({
    queries: labelProjectIds.map((pid) => labelsCanonicalOptions({ organizationId, tenantId, projectId: pid })),
    combine: combineTaskLabels,
  });
  const usage = useLabelUsage(labelProjectIds);

  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: createLabelMutation } = useLabelCreateMutation(tenantId, organizationId);

  const [selectedLabels, setSelectedLabels] = useLiveSelection(taskId, (task) => task.labels, currentLabels);

  const [searchValue, setSearchValue] = useState('');
  const [selectedCollapsed, setSelectedCollapsed] = useState(initialSelectedCollapsed ?? !isMobile);

  const trackUsage = useLabelRecencyStore((state) => state.trackUsage);
  const getScore = useLabelRecencyStore((state) => state.getScore);

  const focusInput = () => {
    if (!isTouchInteraction()) inputRef.current?.focus();
  };

  const projectLabels = labels.filter((label) => label.projectId === projectId);

  const allLabels = deduplicateLabels(labels, projectId, organizationId, usage);

  // Labels are meant to be lowercase, but older and seeded names carry capitals and spaces: normalize them as the input is
  const searchResults = searchValue.length
    ? getItemsSortedByName(allLabels.filter(({ name }) => name.toLowerCase().replaceAll(' ', '-').includes(searchValue)))
    : [];

  // Top labels by recency, then usedCount, then name, excluding the selected
  const selectedSlugs = new Set(selectedLabels.map((label) => label.slug));
  const suggestedLabels = allLabels
    .filter((label) => !selectedSlugs.has(label.slug))
    .sort((a, b) => {
      const recency = getScore(organizationId, b.slug) - getScore(organizationId, a.slug);
      if (recency !== 0) return recency;
      const usageDiff = b.usedCount - a.usedCount;
      if (usageDiff !== 0) return usageDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, suggestedLabelCount);

  const visibleLabels = searchValue ? searchResults : [...selectedLabels, ...suggestedLabels];

  const renderLabelItem = (label: Label | TaskLabel, hotkeyIndex?: number) => {
    const isSelected = selectedLabels.some((selected) => selected.slug === label.slug);
    const LabelModeIcon = label.mode === 'epic' ? FlagIcon : TagIcon;
    return (
      <ComboboxItem key={label.id} value={label.slug} className={cn(comboboxRowClass, isSelected && 'font-medium')}>
        <LabelModeIcon className="mr-1 ml-0.5 size-3.5 shrink-0 opacity-50" />
        <div className={cn('grow', label.projectId !== projectId && !isSelected && 'opacity-50')}>{label.name}</div>
        <span className="pointer-events-none flex size-4 items-center justify-center">
          {isSelected && <CheckIcon className="pointer-coarse:size-5 size-4 text-success" />}
        </span>
        <HotkeyIndexBadge index={searchValue ? undefined : hotkeyIndex} />
      </ComboboxItem>
    );
  };

  // For non-create rows `value` is the label slug, the cross-project group identity: a suggested representative resolves to this project's row.
  const handleSelectClick = async (value?: string | null): Promise<void> => {
    if (!value) return;

    if (value.startsWith(createSentinelPrefix)) {
      return handleCreateClick(value.slice(createSentinelPrefix.length));
    }

    setSearchValue('');
    focusInput();

    const existingLabel = selectedLabels.find((label) => label.slug === value);
    if (existingLabel) {
      const updatedLabels = selectedLabels.filter((label) => label.id !== existingLabel.id);
      setSelectedLabels(updatedLabels);
      onChange(updatedLabels);
      return;
    }

    const newLabel = projectLabels.find((label) => label.slug === value);
    if (newLabel) {
      const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
      setSelectedLabels(updatedLabels);
      onChange(updatedLabels);
      trackUsage(organizationId, [newLabel.slug]);
      return;
    }

    handleCreateClick(value);
  };

  const handleCreateClick = async (value: string): Promise<void> => {
    setSearchValue('');

    // Resolving the typed name through its slug reuses an existing label identity.
    const slug = labelSlug(value);
    const existingLabel = projectLabels.find((label) => label.slug === slug);
    if (existingLabel) return handleSelectClick(existingLabel.slug);

    focusInput();

    const matchedLabelColor = labels.find((label) => label.slug === slug)?.color;
    const fallbackColor = labelColors[Math.floor(Math.random() * labelColors.length)];

    const newLabelData = {
      id: generateId(),
      name: value,
      // Ad-hoc created labels are always secondary; primary/epic labels are managed elsewhere.
      mode: 'secondary' as const,
      slug,
      icon: null,
      color: matchedLabelColor ?? fallbackColor,
      keywords: '',
      projectId,
      organizationId,
      tenantId,
    };

    const newLabel = createOptimisticEntity(zLabel, newLabelData);

    const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
    setSelectedLabels(updatedLabels);

    // Create label first, then update task after the server has the referenced label.
    const createdLabels = await createLabelMutation(newLabelData);
    // Creates never coalesce, so this always resolves to the created labels; the guard narrows the type.
    if (createdLabels === coalescedResult) return;
    const finalLabels = updatedLabels.map((label) => (label.id === newLabel.id ? createdLabels[0] : label));
    setSelectedLabels(finalLabels);
    onChange(finalLabels);
    trackUsage(organizationId, [newLabelData.slug]);
  };

  const createItem = searchValue.trim() !== '' && !projectLabels.some((label) => label.slug === labelSlug(searchValue)) && (
    <ComboboxItem value={`${createSentinelPrefix}${searchValue}`} className={cn(comboboxActionButtonClass, isMobile ? 'mb-1' : 'mt-1')}>
      {t('c:create_resource', { resource: t('c:label').toLowerCase() })}
      <Badge className="ml-2 px-2 py-0" variant="plain">
        {searchValue}
      </Badge>
    </ComboboxItem>
  );

  return (
    <Combobox<string>
      inline
      openOnInputClick={false}
      value={null}
      onValueChange={(value) => handleSelectClick(value)}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        const hotkeyLabel = matchDigitHotkey(suggestedLabels, value, { max: suggestedLabelCount });
        if (hotkeyLabel) {
          handleSelectClick(hotkeyLabel.slug);
          return;
        }
        const updated = value.trim() ? value.replaceAll(' ', '-') : value;
        setSearchValue(updated.toLowerCase());
      }}
      filter={() => true}
    >
      <div className={comboboxShellClass} style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}>
        <ComboboxSearchInput
          ref={inputRef}
          autoFocus={!isTouchInteraction()}
          value={searchValue}
          wrapClassName={comboboxInputPinClass}
          className="min-h-10 leading-normal"
          placeholder={
            visibleLabels.length
              ? t('c:select_or_create_resource', { resource: t('c:label').toLowerCase() })
              : projectLabels.length
                ? t('c:create_label.text')
                : t('c:create_first_label.text')
          }
          showClear={false}
        />
        <ComboboxHotkeyHint searching={!!searchValue}>L</ComboboxHotkeyHint>
        {!searchValue && selectedLabels.length > 0 && (
          <button
            type="button"
            aria-expanded={!selectedCollapsed}
            aria-controls="select-labels-selected-group"
            className="mx-1 mt-1 flex w-[calc(100%-0.5rem)] shrink-0 items-center gap-2 pointer-coarse:px-3 px-2 pointer-coarse:py-2 py-1.5 pointer-coarse:text-sm text-muted-foreground text-xs outline-hidden hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setSelectedCollapsed((collapsed) => !collapsed)}
          >
            {t('c:selected')}
            {selectedCollapsed && <span className="ml-1 text-xs opacity-70">{selectedLabels.length}</span>}
            <span className="grow" />
            <ChevronDownIcon className={cn('size-3.5 transition-transform', !selectedCollapsed && 'rotate-180')} />
          </button>
        )}
        <ScrollArea className={comboboxScrollClass}>
          <ComboboxList className="p-1!">
            {/* The keyboard covers the end of the list on phones, so create comes first there and is the auto-highlighted Enter target. */}
            {isMobile && createItem}
            {searchValue ? (
              searchResults.length > 0 ? (
                <ComboboxGroup>
                  <ComboboxGroupLabel>{t('c:results')}</ComboboxGroupLabel>
                  {searchResults.map((label) => renderLabelItem(label))}
                </ComboboxGroup>
              ) : (
                <div className="flex items-center justify-center p-1.5 text-center text-muted-foreground/50 text-sm">
                  {t('c:no_resource_found', { resource: t('c:label_other').toLowerCase() })}
                </div>
              )
            ) : (
              <>
                {selectedLabels.length > 0 && !selectedCollapsed && (
                  <ComboboxGroup id="select-labels-selected-group">{selectedLabels.map((label) => renderLabelItem(label))}</ComboboxGroup>
                )}
                <ComboboxGroup>
                  <ComboboxGroupLabel>{t('c:suggested')}</ComboboxGroupLabel>
                  {suggestedLabels.map((label, index) => renderLabelItem(label, index))}
                </ComboboxGroup>
              </>
            )}
            {!isMobile && createItem}
          </ComboboxList>
          {visibleLabels.length === 0 && searchValue.trim() === '' && (
            <div className="flex items-center justify-center p-1.5 text-muted-foreground/50 text-sm">
              {t('c:no_resource_yet', { resource: t('c:label_other').toLowerCase() })}
            </div>
          )}
        </ScrollArea>
      </div>
    </Combobox>
  );
}
