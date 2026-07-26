import { TagIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { Spinner } from '~/modules/common/spinner';
import { LabelPage } from '~/modules/label/label-page';
import type { LabelsScopeProps } from '~/modules/label/types';
import { LocalPanelShell } from '~/modules/task/panel/local-panel-shell';
import { LABELS_PANEL_ID } from '~/modules/task/types';
import { lazyNamed } from '~/utils/lazy-named';

const LabelList = lazyNamed(() => import('~/modules/label/label-list'), 'LabelList');

/**
 * Always-present board panel hosting the labels table (secondary tags + epics).
 * Collapsible, resizable and movable like other panels; defaults to the end of the board.
 */
export const LabelsPanel = ({ entity, entityId }: LabelsScopeProps) => {
  const { t } = useTranslation();
  const { search } = useSearchParams<{ labelPageId?: string }>({});
  const labelPageId = search.labelPageId;

  return (
    <LocalPanelShell panelId={LABELS_PANEL_ID} icon={<TagIcon />} title={t('c:label_other')}>
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
          {labelPageId ? (
            <LabelPage labelId={labelPageId} entity={entity} entityId={entityId} />
          ) : (
            <LabelList entity={entity} entityId={entityId} />
          )}
        </Suspense>
      </div>
    </LocalPanelShell>
  );
};
