import { TagIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { Spinner } from '~/modules/common/spinner';
// LabelList is eagerly imported (not lazy): the panel is always present on the board, so a separate
// chunk would only make labels render a round-trip after tasks. LabelPage stays lazy (heavier).
import { LabelList } from '~/modules/label/label-list';
import { LabelPage } from '~/modules/label/label-page';
import type { LabelsScopeProps } from '~/modules/label/types';
import { LABELS_PANEL_ID } from '~/modules/label/types';

/**
 * Always-present board panel hosting the labels table (secondary tags + epics).
 * Collapsible, resizable and movable like other panels; defaults to the end of the board.
 */
export const LabelsPanel = ({ entity, entityId, windowScroll }: LabelsScopeProps & { windowScroll?: boolean }) => {
  const { t } = useTranslation();
  const { search } = useSearchParams<{ labelPageId?: string }>({});
  const labelPageId = search.labelPageId;

  return (
    <LocalPanelShell
      panelId={LABELS_PANEL_ID}
      icon={<TagIcon />}
      title={t('c:label_other')}
      windowScroll={windowScroll}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
          {labelPageId ? (
            <LabelPage labelId={labelPageId} entity={entity} entityId={entityId} windowScroll={windowScroll} />
          ) : (
            <LabelList entity={entity} entityId={entityId} windowScroll={windowScroll} />
          )}
        </Suspense>
      </div>
    </LocalPanelShell>
  );
};
