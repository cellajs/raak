import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMatch } from '@tanstack/react-router';
import { CheckIcon, ChevronDownIcon, DotIcon } from 'lucide-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zLabel } from 'sdk/zod.gen';
import { generateId } from 'shared/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { deduplicateLabels } from '~/modules/label/deduplicate-labels';
import { useLabelRecencyStore } from '~/modules/label/label-recency-store';
import { type Label, labelsCanonicalOptions, useLabelCreateMutation } from '~/modules/label/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { SelectLabelsProps } from '~/modules/task/dropdowns/types';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { useLiveSelection } from '~/modules/task/hooks/use-live-selection';
import { labelColors } from '~/modules/task/task-styles';
import type { TaskLabel } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import {
  Combobox,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxList,
  ComboboxSearchInput,
} from '~/modules/ui/combobox';
import { Kbd } from '~/modules/ui/kbd';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { cn } from '~/utils/cn';
import { inNumbersArray } from '~/utils/in-numbers-array';

// Sentinel prefix for the "create label" row's Combobox value, so it can't
// collide with a real label name when selection flows through onValueChange.
const CREATE_SENTINEL_PREFIX = '__create__';

const renderLabelItem = (
  label: Label | TaskLabel,
  selectedLabels: (Label | TaskLabel)[],
  projectId: string,
  searchValue: string,
  hotkeyIndex?: number,
) => {
  const isSelected = selectedLabels.some((l) => l.name === label.name);
  return (
    <ComboboxItem
      key={label.id}
      value={label.name}
      className="group flex w-full items-center gap-2 rounded-md leading-normal"
    >
      <DotIcon
        className="mr-1 ml-0.5 rounded-md text-background"
        size={10}
        style={{ background: label.color || undefined }}
        strokeWidth={6}
      />
      <div className={cn('grow', label.projectId !== projectId && !isSelected && 'opacity-50')}>{label.name}</div>
      <span className="pointer-events-none flex size-4 items-center justify-center">
        {isSelected && <CheckIcon className="pointer-coarse:size-5 size-4 text-success" />}
      </span>
      {!searchValue && hotkeyIndex !== undefined && (
        <span className="mx-1 text-sm opacity-50 max-sm:hidden sm:text-xs">{hotkeyIndex + 1}</span>
      )}
    </ComboboxItem>
  );
};

export const SelectLabels = ({
  value: currentLabels,
  projectId,
  workspaceId: workspaceIdProp,
  onChange,
  taskId,
  triggerWidth = 320,
}: SelectLabelsProps) => {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const { tenantId, organization } = useOrganizationLayoutContext();

  const organizationId = organization.id;

  // Auto-detect workspace from route context if not passed as prop
  const workspaceMatch = useMatch({
    from: '/_app/$tenantId/$organizationSlug/workspace/$slug',
    shouldThrow: false,
  });
  const workspaceId = workspaceIdProp ?? (workspaceMatch?.context as { workspace?: { id: string } })?.workspace?.id;

  const labelsQuery = useQuery(
    labelsCanonicalOptions({
      organizationId,
      tenantId,
    }),
  );
  const allLabels = labelsQuery.data?.items ?? [];

  // Reactively read the workspace's projects from cache (enabled → subscribes so labels re-scope
  // when the list updates; in a workspace route the board has already fetched it).
  const { data: workspaceProjectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspaceId ?? '' }),
    enabled: !!workspaceId,
    select: (data) => new Set(data.pages.flatMap((page) => page.items.map((p) => p.id))),
  });

  // Scope labels to workspace projects (falls back to all org labels outside a workspace or before
  // the projects list has loaded).
  const labels = useMemo(() => {
    if (!workspaceId || !workspaceProjectIds) return allLabels;
    return allLabels.filter((l) => workspaceProjectIds.has(l.projectId));
  }, [allLabels, workspaceId, workspaceProjectIds]);

  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: createLabelMutation } = useLabelCreateMutation(tenantId, organizationId);

  const [selectedLabels, setSelectedLabels] = useLiveSelection(taskId, (t) => t.labels, currentLabels);

  const [searchValue, setSearchValue] = useState('');
  const [selectedCollapsed, setSelectedCollapsed] = useState(!isMobile);

  const { trackUsage, getScore } = useLabelRecencyStore();

  const projectLabels = useMemo(() => labels.filter((l) => l.projectId === projectId), [labels, projectId]);

  // Derive initLabels directly from query data. Memoized so a keystroke (searchValue) doesn't rebuild
  // it and invalidate the searchResults / suggestedLabels memos that depend on its identity.
  const initLabels = useMemo(
    () => deduplicateLabels(labels, projectId, organizationId),
    [labels, projectId, organizationId],
  );

  // Search results filtered by query
  const searchResults = useMemo(() => {
    if (!searchValue.length) return [];
    const matchedLabels = initLabels.filter(({ name }) => name.includes(searchValue));
    return getItemsSortedByName(matchedLabels);
  }, [searchValue, initLabels]);

  // Top 8 labels by recency → usedCount → name, excluding already-selected
  const suggestedLabels = useMemo(() => {
    const selectedNames = new Set(selectedLabels.map((l) => l.name));
    return initLabels
      .filter((l) => !selectedNames.has(l.name))
      .sort((a, b) => {
        const recency = getScore(organizationId, b.name) - getScore(organizationId, a.name);
        if (recency !== 0) return recency;
        const usage = (b.usedCount ?? 0) - (a.usedCount ?? 0);
        if (usage !== 0) return usage;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [initLabels, selectedLabels, getScore, organizationId]);

  // Combined list for rendering (selected first, then suggested)
  const visibleLabels = useMemo(
    () => (searchValue ? searchResults : [...selectedLabels, ...suggestedLabels]),
    [searchValue, searchResults, selectedLabels, suggestedLabels],
  );

  const updateTaskLabels = (updatedLabels: (Label | TaskLabel)[]) => {
    onChange(updatedLabels);
  };

  const handleSelectClick = async (value?: string | null): Promise<void> => {
    if (!value) return;

    // Create row selected (via click or Enter): strip sentinel and create.
    if (value.startsWith(CREATE_SENTINEL_PREFIX)) {
      return handleCreateClick(value.slice(CREATE_SENTINEL_PREFIX.length));
    }

    setSearchValue('');

    if (inputRef.current && !isMobile) inputRef.current.focus();

    const existingLabel = selectedLabels.find((label) => label.name === value);
    if (existingLabel) {
      const updatedLabels = selectedLabels.filter((label) => label.id !== existingLabel.id);
      setSelectedLabels(updatedLabels);
      updateTaskLabels(updatedLabels);
      return;
    }

    const newLabel = projectLabels.find((label) => label.name === value);
    if (newLabel) {
      const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
      setSelectedLabels(updatedLabels);
      updateTaskLabels(updatedLabels);
      trackUsage(organizationId, [newLabel.name]);
      return;
    }

    handleCreateClick(value);
  };

  const handleCreateClick = async (value: string): Promise<void> => {
    setSearchValue('');

    const existingLabel = projectLabels.find(({ name }) => name === value);
    if (existingLabel) return handleSelectClick(value);

    if (inputRef.current && !isMobile) inputRef.current.focus();

    const matchedLabelColor = labels.find(({ name }) => name === value)?.color;
    const fallbackColor = labelColors[Math.floor(Math.random() * labelColors.length)];

    const newLabelData = {
      id: generateId(),
      name: value,
      color: matchedLabelColor ?? fallbackColor,
      keywords: '',
      projectId,
      usedCount: 0,
      organizationId: organizationId,
      tenantId,
    };

    // Build full label from schema defaults + creation data (avoids manual field repetition)
    const newLabel = createOptimisticEntity(zLabel, newLabelData);

    // Sort updated labels by name
    const updatedLabels = getItemsSortedByName([...selectedLabels, newLabel]);
    setSelectedLabels(updatedLabels);

    // Create label first, then update task — label must exist on server before the task references it.
    const createdLabel = await createLabelMutation(newLabelData);
    const finalLabels = updatedLabels.map((l) => (l.id === newLabel.id ? createdLabel : l));
    setSelectedLabels(finalLabels);
    updateTaskLabels(finalLabels);
    trackUsage(organizationId, [value]);
  };

  return (
    <Combobox<string>
      inline
      openOnInputClick={false}
      value={null}
      onValueChange={(value) => handleSelectClick(value)}
      inputValue={searchValue}
      onInputValueChange={(value) => {
        // Digit hotkey: pick suggested label by 1-based index
        if (inNumbersArray(suggestedLabels.length < 8 ? suggestedLabels.length : 8, value)) {
          handleSelectClick(suggestedLabels[Number.parseInt(value, 10) - 1]?.name);
          return;
        }
        // Replace spaces with dashes only when there's content
        const updated = value.trim() ? value.replaceAll(' ', '-') : value;
        setSearchValue(updated.toLowerCase());
      }}
      filter={() => true}
    >
      <div
        className="relative overflow-y-auto rounded-lg sm:max-h-[44vh] sm:w-(--trigger-width)"
        style={{ '--trigger-width': `${triggerWidth}px` } as CSSProperties}
      >
        <ComboboxSearchInput
          ref={inputRef}
          autoFocus={!isMobile}
          value={searchValue}
          wrapClassName="max-sm:border-b-0 max-sm:mb-4"
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
        {!searchValue && <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">L</Kbd>}
        {!searchValue && selectedLabels.length > 0 && (
          <button
            type="button"
            aria-expanded={!selectedCollapsed}
            aria-controls="select-labels-selected-group"
            className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 pointer-coarse:px-3 px-2 pointer-coarse:py-2 py-1.5 pointer-coarse:text-sm text-muted-foreground text-xs outline-hidden hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setSelectedCollapsed(!selectedCollapsed)}
          >
            {t('c:selected')}
            {selectedCollapsed && <span className="ml-1 text-xs opacity-70">{selectedLabels.length}</span>}
            <span className="grow" />
            <ChevronDownIcon className={cn('size-3.5 transition-transform', !selectedCollapsed && 'rotate-180')} />
          </button>
        )}
        <ScrollArea>
          <ComboboxList className="p-1!">
            {searchValue ? (
              <ComboboxGroup>
                <ComboboxGroupLabel>{t('c:results')}</ComboboxGroupLabel>
                {searchResults.map((label) => renderLabelItem(label, selectedLabels, projectId, searchValue))}
              </ComboboxGroup>
            ) : (
              <>
                {selectedLabels.length > 0 && !selectedCollapsed && (
                  <ComboboxGroup id="select-labels-selected-group">
                    {selectedLabels.map((label) => renderLabelItem(label, selectedLabels, projectId, searchValue))}
                  </ComboboxGroup>
                )}
                <ComboboxGroup>
                  <ComboboxGroupLabel>{t('c:suggested')}</ComboboxGroupLabel>
                  {suggestedLabels.map((label, index) =>
                    renderLabelItem(label, selectedLabels, projectId, searchValue, index),
                  )}
                </ComboboxGroup>
              </>
            )}
            {searchValue.trim() !== '' && !projectLabels.some(({ name }) => name === searchValue) && (
              <ComboboxItem
                value={`${CREATE_SENTINEL_PREFIX}${searchValue}`}
                className="flex justify-center text-sm sm:text-xs"
              >
                {t('c:create_resource', { resource: t('c:label').toLowerCase() })}
                <Badge className="ml-2 flex px-2 py-0" variant="plain">
                  {searchValue}
                </Badge>
              </ComboboxItem>
            )}
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
};
