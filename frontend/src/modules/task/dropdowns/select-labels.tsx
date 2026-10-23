import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { useMatch } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, FlagIcon, TagIcon } from 'lucide-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zLabel } from 'sdk/zod.gen';
import { labelSlug } from 'shared/config/labels-config';
import { generateId } from 'shared/utils/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
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

// Sentinel prefix for the "create label" row's Combobox value, so it can't
// collide with a real label name when selection flows through onValueChange.
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

// The task label picker offers secondary tags and epics; primary labels have dedicated task-card UI.
// Module-scoped so its identity is stable: an inline combine rebuilds `labels` every render,
// cascading through the projectLabels / allLabels memos that depend on it by reference.
const combineTaskLabels = (results: { data?: { items: Label[] } }[]): Label[] =>
  results.flatMap((result) => result.data?.items ?? []).filter((label) => label.mode !== 'primary');

const renderLabelItem = (
  label: Label | TaskLabel,
  selectedLabels: (Label | TaskLabel)[],
  projectId: string,
  searchValue: string,
  hotkeyIndex?: number,
) => {
  const isSelected = selectedLabels.some((selected) => selected.slug === label.slug);
  const LabelModeIcon = label.mode === 'epic' ? FlagIcon : TagIcon;
  return (
    <ComboboxItem
      key={label.id}
      value={label.slug}
      className={cn('group flex h-9 w-full items-center gap-2 rounded-md pr-2 leading-normal', isSelected && 'font-medium')}
    >
      <LabelModeIcon className="mr-1 ml-0.5 size-3.5 shrink-0 opacity-50" />
      <div className={cn('grow', label.projectId !== projectId && !isSelected && 'opacity-50')}>{label.name}</div>
      <span className="pointer-events-none flex size-4 items-center justify-center">
        {isSelected && <CheckIcon className="pointer-coarse:size-5 size-4 text-success" />}
      </span>
      <HotkeyIndexBadge index={searchValue ? undefined : hotkeyIndex} />
    </ComboboxItem>
  );
};

export function SelectLabels({ value: currentLabels, projectId, onChange, taskId, triggerWidth = 320, initialSelectedCollapsed }: SelectLabelsProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const workspaceId = useMatch({
    from: '/_app/$tenantId/$organizationSlug/workspace/$slug',
    shouldThrow: false,
    select: (match) => match.context.workspace?.id,
  });

  // Reactively read the workspace's projects from cache (enabled → subscribes so labels re-scope
  // when the list updates; in a workspace route the board has already fetched it).
  const { data: workspaceProjectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspaceId ?? '' }),
    enabled: !!workspaceId,
    select: (data) => data.pages.flatMap((page) => page.items.map((project) => project.id)),
  });

  // Labels are project-homed: aggregate the per-project canonical home lists client-side. Inside a
  // workspace, span its projects; outside one, just the current project. Falls back to the current
  // project until the workspace project list has loaded.
  const labelProjectIds = useMemo(
    () => (workspaceId && workspaceProjectIds ? workspaceProjectIds : [projectId]),
    [workspaceId, workspaceProjectIds, projectId],
  );

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

  const projectLabels = useMemo(() => labels.filter((label) => label.projectId === projectId), [labels, projectId]);

  // Derive allLabels directly from query data. Memoized so a keystroke (searchValue) doesn't rebuild
  // it and invalidate the searchResults / suggestedLabels memos that depend on its identity.
  const allLabels = useMemo(() => deduplicateLabels(labels, projectId, organizationId, usage), [labels, projectId, organizationId, usage]);

  // Search results filtered by query
  const searchResults = useMemo(() => {
    if (!searchValue.length) return [];
    // Labels are meant to be lowercase, but older and seeded names carry capitals and spaces: normalize them as the input is
    const matchedLabels = allLabels.filter(({ name }) => name.toLowerCase().replaceAll(' ', '-').includes(searchValue));
    return getItemsSortedByName(matchedLabels);
  }, [searchValue, allLabels]);

  // Top labels by recency → usedCount → name, excluding already-selected
  const suggestedLabels = useMemo(() => {
    const selectedSlugs = new Set(selectedLabels.map((label) => label.slug));
    return allLabels
      .filter((label) => !selectedSlugs.has(label.slug))
      .sort((a, b) => {
        const recency = getScore(organizationId, b.slug) - getScore(organizationId, a.slug);
        if (recency !== 0) return recency;
        const usageDiff = b.usedCount - a.usedCount;
        if (usageDiff !== 0) return usageDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, suggestedLabelCount);
  }, [allLabels, selectedLabels, getScore, organizationId]);

  // Combined list for rendering (selected first, then suggested)
  const visibleLabels = useMemo(
    () => (searchValue ? searchResults : [...selectedLabels, ...suggestedLabels]),
    [searchValue, searchResults, selectedLabels, suggestedLabels],
  );

  const updateTaskLabels = (updatedLabels: (Label | TaskLabel)[]) => {
    onChange(updatedLabels);
  };

  // For non-create rows `value` is the picked label's slug (the ComboboxItem value); the slug is the
  // cross-project group identity, so a suggested representative resolves to this project's own row.
  const handleSelectClick = async (value?: string | null): Promise<void> => {
    if (!value) return;

    // Create row selected (via click or Enter): strip sentinel and create.
    if (value.startsWith(createSentinelPrefix)) {
      return handleCreateClick(value.slice(createSentinelPrefix.length));
    }

    setSearchValue('');

    if (inputRef.current && !isTouchInteraction()) inputRef.current.focus();

    const existingLabel = selectedLabels.find((label) => label.slug === value);
    if (existingLabel) {
      const updatedLabels = selectedLabels.filter((label) => label.id !== existingLabel.id);
      setSelectedLabels(updatedLabels);
      updateTaskLabels(updatedLabels);
      return;
    }

    const newLabel = projectLabels.find((label) => label.slug === value);
    if (newLabel) {
      const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
      setSelectedLabels(updatedLabels);
      updateTaskLabels(updatedLabels);
      trackUsage(organizationId, [newLabel.slug]);
      return;
    }

    handleCreateClick(value);
  };

  const handleCreateClick = async (value: string): Promise<void> => {
    setSearchValue('');

    // Resolve the typed name through its slug to reuse an existing label identity.
    const slug = labelSlug(value);
    const existingLabel = projectLabels.find((label) => label.slug === slug);
    if (existingLabel) return handleSelectClick(existingLabel.slug);

    if (inputRef.current && !isTouchInteraction()) inputRef.current.focus();

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
      organizationId: organizationId,
      tenantId,
    };

    // Build full label from schema defaults + creation data (avoids manual field repetition)
    const newLabel = createOptimisticEntity(zLabel, newLabelData);

    // Sort updated labels by name
    const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
    setSelectedLabels(updatedLabels);

    // Create label first, then update task after the server has the referenced label.
    const createdLabels = await createLabelMutation(newLabelData);
    // Creates never coalesce, so this always resolves to the created labels; the guard narrows the type.
    if (createdLabels === coalescedResult) return;
    const finalLabels = updatedLabels.map((label) => (label.id === newLabel.id ? createdLabels[0] : label));
    setSelectedLabels(finalLabels);
    updateTaskLabels(finalLabels);
    trackUsage(organizationId, [newLabelData.slug]);
  };

  const createItem = searchValue.trim() !== '' && !projectLabels.some((label) => label.slug === labelSlug(searchValue)) && (
    <ComboboxItem value={`${createSentinelPrefix}${searchValue}`} className={cn(comboboxActionButtonClass, isMobile ? 'mb-1' : 'mt-1')}>
      {t('c:create_resource', { resource: t('c:label').toLowerCase() })}
      <Badge className="ml-2 flex px-2 py-0" variant="plain">
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
        // Digit hotkey: pick suggested label by 1-based index
        const hotkeyLabel = matchDigitHotkey(suggestedLabels, value, { max: suggestedLabelCount });
        if (hotkeyLabel) {
          handleSelectClick(hotkeyLabel.slug);
          return;
        }
        // Replace spaces with dashes only when there's content
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
            onClick={() => setSelectedCollapsed(!selectedCollapsed)}
          >
            {t('c:selected')}
            {selectedCollapsed && <span className="ml-1 text-xs opacity-70">{selectedLabels.length}</span>}
            <span className="grow" />
            <ChevronDownIcon className={cn('size-3.5 transition-transform', !selectedCollapsed && 'rotate-180')} />
          </button>
        )}
        <ScrollArea className={comboboxScrollClass}>
          <ComboboxList className="p-1!">
            {/* The keyboard covers the end of the list on phones, so create comes first there, which also makes it the auto-highlighted Enter target. */}
            {isMobile && createItem}
            {searchValue ? (
              searchResults.length > 0 ? (
                <ComboboxGroup>
                  <ComboboxGroupLabel>{t('c:results')}</ComboboxGroupLabel>
                  {searchResults.map((label) => renderLabelItem(label, selectedLabels, projectId, searchValue))}
                </ComboboxGroup>
              ) : (
                <div className="flex items-center justify-center p-1.5 text-center text-muted-foreground/50 text-sm">
                  {t('c:no_resource_found', { resource: t('c:label_other').toLowerCase() })}
                </div>
              )
            ) : (
              <>
                {selectedLabels.length > 0 && !selectedCollapsed && (
                  <ComboboxGroup id="select-labels-selected-group">
                    {selectedLabels.map((label) => renderLabelItem(label, selectedLabels, projectId, searchValue))}
                  </ComboboxGroup>
                )}
                <ComboboxGroup>
                  <ComboboxGroupLabel>{t('c:suggested')}</ComboboxGroupLabel>
                  {suggestedLabels.map((label, index) => renderLabelItem(label, selectedLabels, projectId, searchValue, index))}
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
