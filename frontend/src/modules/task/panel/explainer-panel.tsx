import { InfoIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { Spinner } from '~/modules/common/spinner';
import { PanelDragHandleButton } from '~/modules/task/panel/panel-drag-handle-button';
import { EXPLAINER_PANEL_ID } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { ScrollArea, ScrollBar } from '~/modules/ui/scroll-area';

/**
 * Explainer panel content for task board showing organization welcome text.
 */
export const ExplainerPanel = () => {
  const { t } = useTranslation();

  const { organization, tenantId } = useOrganizationLayoutContext();
  const { setAlertSeen } = useAlertStore();
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[EXPLAINER_PANEL_ID]);

  const setAsSeen = () => setAlertSeen('welcome-text');

  return (
    <BoardPanelContent
      isCollapsed={!!isCollapsed}
      collapsedContent={
        <PanelDragHandleButton
          name={t('c:getting_started')}
          fallbackLabel={t('c:getting_started')}
          className="flex h-auto min-h-13 w-12.5 items-center justify-center p-0 hover:bg-transparent"
        >
          <InfoIcon />
        </PanelDragHandleButton>
      }
    >
      <div className="relative flex max-w-full flex-1 shrink-0 snap-center flex-col rounded-md rounded-b-none bg-transparent opacity-100 sm:h-[calc(100vh-78px)] sm:border">
        <ScrollArea id={'explainer-scrollarea'} className="h-full">
          <ScrollBar />

          <div className="flex h-full flex-col">
            <div className="flex min-h-13 items-center justify-between gap-2 truncate border-b bg-card px-2 font-semibold text-sm">
              <PanelDragHandleButton
                name={t('c:getting_started')}
                fallbackLabel={t('c:getting_started')}
                className="flex h-8 items-center gap-2 truncate p-2 hover:bg-transparent"
              >
                <InfoIcon />
                <div className="truncate">{t('c:getting_started')}</div>
              </PanelDragHandleButton>
              <div className="grow" />
              <Button
                variant="ghost"
                size="sm"
                className="font-normal opacity-70 hover:opacity-100"
                onClick={setAsSeen}
              >
                <span>{t('c:dont_show_again')}</span>
              </Button>
            </div>

            <div className="select-text p-4">
              <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
                <BlockNoteFullHtml
                  id="board-explainer"
                  defaultValue={organization.welcomeText || ''}
                  className="inline leading-none"
                  tenantId={tenantId}
                  organizationId={organization.id}
                />
              </Suspense>
            </div>
          </div>
        </ScrollArea>
      </div>
    </BoardPanelContent>
  );
};
