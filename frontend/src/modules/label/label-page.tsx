import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, Trash2Icon } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { Spinner } from '~/modules/common/spinner';
import { findLabelGroup } from '~/modules/label/group-labels';
import { LabelFilterButton } from '~/modules/label/label-filter';
import {
  labelQueryOptions,
  labelsQueryOptions,
  useLabelDeleteMutation,
  useLabelUpdateMutation,
} from '~/modules/label/query';
import type { LabelsScopeProps } from '~/modules/label/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { Switch } from '~/modules/ui/switch';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

type LabelPageProps = LabelsScopeProps & { labelId: string; windowScroll?: boolean };

/**
 * In-panel label page: back navigation, in-place rename, filter-by toggle and delete.
 * Secondary labels represent their cross-project name group (edits fan out over siblings);
 * epics are single per-project rows. Epic documentation (description) renders below.
 */
export function LabelPage({ labelId, entity, entityId, windowScroll }: LabelPageProps) {
  const { t } = useTranslation();
  const { organization, tenantId } = useOrganizationLayoutContext();
  const organizationId = organization.id;

  const { setSearch } = useSearchParams<{ labelPageId?: string }>({});

  const { data: label, isLoading } = useQuery(labelQueryOptions(labelId, organizationId, tenantId));

  // Same list query as the panel table (cache-shared): resolves the slug group's siblings
  const listOptions = labelsQueryOptions({
    ...(entity === 'workspace' ? { workspaceId: entityId } : { projectId: entityId }),
    organizationId,
    tenantId,
    modes: 'secondary,epic',
  });
  const { data: allLabels } = useInfiniteQuery({
    ...listOptions,
    select: ({ pages }) => pages.flatMap(({ items }) => items),
  });

  const siblingIds = useMemo(() => {
    if (!label) return [];
    return findLabelGroup(allLabels ?? [], label.id)?.siblingIds ?? [label.id];
  }, [label, allLabels]);

  // Slug groups collapse across projects for display, but epics keep per-row identity: rename and
  // delete act on this one epic, never its same-slug siblings in other projects. Secondary tags are
  // one logical label, so they operate on the whole group.
  const editSiblingIds = label && label.mode === 'epic' ? [label.id] : siblingIds;

  const updateLabel = useLabelUpdateMutation(tenantId, organizationId);
  const deleteLabels = useLabelDeleteMutation(tenantId, organizationId);

  // Tag <-> epic transitions are member-level (backend enforces the same); read-only
  // viewers (guest membership or public access) keep the switch hidden
  const isReadOnly = useIsProjectReadOnly(label?.projectId);
  const canManageEpic = label?.mode !== 'primary' && !isReadOnly;

  const [editingName, setEditingName] = useState<string | null>(null);

  const goBack = () => setSearch({ labelPageId: undefined });

  if (isLoading) return <Spinner className="my-8 h-6 w-6 opacity-50" />;
  if (!label) {
    return (
      <div className="flex flex-col items-start gap-2 p-2">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeftIcon className="icon-sm" />
          {t('c:back')}
        </Button>
        <span className="p-2 text-muted-foreground text-sm">{t('c:no_results')}</span>
      </div>
    );
  }

  const commitName = () => {
    const name = editingName?.trim();
    setEditingName(null);
    if (!name || name === label.name) return;
    // Secondary slug-groups rename every sibling row; epics rename their single row
    for (const siblingId of editSiblingIds) updateLabel.mutate({ id: siblingId, ops: { name } });
  };

  const onDelete = async () => {
    const rows = (allLabels ?? []).filter((l) => editSiblingIds.includes(l.id));
    await deleteLabels.mutateAsync(rows.length ? rows : [label]);
    goBack();
  };

  const body = (
    <>
      {/* Tag <-> epic switch (any project member): promoting acts on this row only; name-group
          siblings in other projects stay tags. Enabling reveals the description below. */}
      {canManageEpic && (
        <div className="flex items-center gap-2 border-b p-2 pl-3">
          <Switch
            id={`epic-switch-${label.id}`}
            checked={label.mode === 'epic'}
            onCheckedChange={(checked) =>
              updateLabel.mutate({ id: label.id, ops: { mode: checked ? 'epic' : 'secondary' } })
            }
            aria-label={t('c:epic')}
          />
          <label htmlFor={`epic-switch-${label.id}`} className="cursor-pointer select-none pl-1 text-sm leading-none">
            {t('c:epic')}
          </label>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('c:remove')}
            onClick={onDelete}
            className="ml-auto shrink-0 opacity-60 hover:text-destructive hover:opacity-100"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}

      {/* Epic documentation: collaborative description editor (epics only) */}
      {label.mode === 'epic' && (
        <Suspense fallback={<Spinner className="my-8 h-6 w-6 opacity-50" noDelay />}>
          <LabelDescriptionForm label={label} />
        </Suspense>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Rows carry their own inner padding (none outside) so bottom borders span full width */}
      <div className="flex items-center gap-1 border-b p-2">
        <Button variant="ghost" size="icon" aria-label={t('c:back')} onClick={goBack} className="shrink-0">
          <ArrowLeftIcon className="icon-sm" />
        </Button>

        {/* Edit and display boxes share height, padding and border so the swap causes no layout
            shift; w-auto keeps the input's preferred flex size content-based like the button's */}
        {editingName !== null ? (
          <Input
            value={editingName}
            autoFocus
            onChange={(event) => setEditingName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName();
              if (event.key === 'Escape') setEditingName(null);
            }}
            className="h-8 w-auto grow px-1 font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(label.name)}
            className="h-8 grow truncate rounded-md border border-transparent px-1 text-left font-semibold hover:bg-accent/50"
            title={t('c:edit')}
          >
            {label.name}
          </button>
        )}

        {label.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>}

        <LabelFilterButton name={label.name} className="shrink-0" />
      </div>

      {/* With windowScroll the page scrolls the whole panel; otherwise everything below the
          pinned name row scrolls together */}
      {windowScroll ? <div className="flex-1">{body}</div> : <ScrollArea className="min-h-0 flex-1">{body}</ScrollArea>}
    </div>
  );
}
