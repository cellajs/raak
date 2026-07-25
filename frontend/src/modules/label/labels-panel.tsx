import { TagIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { Spinner } from '~/modules/common/spinner';
import { LabelPage } from '~/modules/label/label-page';
import type { BaseLabelsTableProps } from '~/modules/label/table/labels-table';
import { PanelDragHandleButton } from '~/modules/task/panel/panel-drag-handle-button';
import { LABELS_PANEL_ID } from '~/modules/task/types';
import { lazyNamed } from '~/utils/lazy-named';

const LabelsTable = lazyNamed(() => import('~/modules/label/table/labels-table'), 'LabelsTable');

/**
 * Always-present board panel hosting the labels table (secondary tags + epics).
 * Collapsible, resizable and movable like other panels; defaults to the end of the board.
 */
export const LabelsPanel = ({ entity, entityId }: BaseLabelsTableProps) => {
  const { t } = useTranslation();
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[LABELS_PANEL_ID]);
  const { search } = useSearchParams<{ labelPageId?: string }>({});
  const labelPageId = search.labelPageId;

  return (
    <BoardPanelContent
      isCollapsed={!!isCollapsed}
      collapsedContent={
        <PanelDragHandleButton
          name={t('c:label_other')}
          fallbackLabel={t('c:label_other')}
          className="flex h-auto min-h-13 w-12.5 items-center justify-center p-0 hover:bg-transparent"
        >
          <TagIcon />
        </PanelDragHandleButton>
      }
    >
      <div className="relative flex max-w-full flex-1 shrink-0 snap-center flex-col rounded-md rounded-b-none bg-transparent sm:h-[calc(100vh-78px)] sm:border">
        <div className="flex min-h-13 items-center justify-between gap-2 truncate border-b bg-card px-2 font-semibold text-sm">
          <PanelDragHandleButton
            name={t('c:label_other')}
            fallbackLabel={t('c:label_other')}
            className="flex h-8 items-center gap-2 truncate p-2 hover:bg-transparent"
          >
            <TagIcon />
            <div className="truncate">{t('c:label_other')}</div>
          </PanelDragHandleButton>
          <div className="grow" />
        </div>

        <div className="flex h-full flex-col overflow-y-auto p-2">
          <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
            {labelPageId ? (
              <LabelPage labelId={labelPageId} entity={entity} entityId={entityId} />
            ) : (
              <LabelsTable entity={entity} entityId={entityId} />
            )}
          </Suspense>
        </div>
      </div>
    </BoardPanelContent>
  );
};
