import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, FlagIcon, TagIcon, Trash2Icon } from 'lucide-react';
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
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

type LabelPageProps = LabelsScopeProps & { labelId: string };

/**
 * In-panel label page: back navigation, in-place rename, filter-by toggle and delete.
 * Secondary labels represent their cross-project name group (edits fan out over siblings);
 * epics are single per-project rows. Epic documentation (description) renders below.
 */
export const LabelPage = ({ labelId, entity, entityId }: LabelPageProps) => {
  const { t } = useTranslation();
  const { organization, tenantId } = useOrganizationLayoutContext();
  const organizationId = organization.id;

  const { setSearch } = useSearchParams<{ labelPageId?: string }>({});

  const { data: label, isLoading } = useQuery(labelQueryOptions(labelId, organizationId, tenantId));

  // Same list query as the panel table (cache-shared): resolves the name group's siblings
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

  const updateLabel = useLabelUpdateMutation(tenantId, organizationId);
  const deleteLabels = useLabelDeleteMutation(tenantId, organizationId);

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
    // Secondary name-groups rename every sibling row; epics rename their single row
    for (const siblingId of siblingIds) updateLabel.mutate({ id: siblingId, ops: { name } });
  };

  const onDelete = async () => {
    const rows = (allLabels ?? []).filter((l) => siblingIds.includes(l.id));
    await deleteLabels.mutateAsync(rows.length ? rows : [label]);
    goBack();
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={t('c:back')} onClick={goBack}>
          <ArrowLeftIcon className="icon-sm" />
        </Button>

        {label.mode === 'epic' ? (
          <FlagIcon className="icon-md shrink-0 opacity-70" aria-hidden="true" />
        ) : (
          <TagIcon className="icon-md shrink-0 opacity-50" aria-hidden="true" />
        )}

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
            className="h-8 grow font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(label.name)}
            className="grow truncate rounded-md p-1 text-left font-semibold hover:bg-accent/50"
            title={t('c:edit')}
          >
            {label.name}
          </button>
        )}

        {label.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>}

        <LabelFilterButton name={label.name} />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('c:remove')}
          onClick={onDelete}
          className="opacity-60 hover:text-destructive hover:opacity-100"
        >
          <Trash2Icon />
        </Button>
      </div>

      {/* Epic documentation: collaborative description editor (epics only) */}
      {label.mode === 'epic' && (
        <div className="grow overflow-y-auto">
          <Suspense fallback={<Spinner className="my-8 h-6 w-6 opacity-50" noDelay />}>
            <LabelDescriptionForm label={label} />
          </Suspense>
        </div>
      )}
    </div>
  );
};
