import { InfoIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { Spinner } from '~/modules/common/spinner';
import { Button } from '~/modules/ui/button';
import { ScrollArea } from '~/modules/ui/scroll-area';

/** Stable id for the explainer ("getting started") panel. Also a persisted board-layout /
 *  collapse-state key, so this string value must not change. */
export const EXPLAINER_PANEL_ID = 'explainer';

/**
 * Explainer panel content for a board showing organization welcome text.
 */
export function ExplainerPanel() {
  const { t } = useTranslation();

  const { organization, tenantId } = useOrganizationLayoutContext();
  const { setAlertSeen } = useAlertStore();

  const setAsSeen = () => setAlertSeen('welcome-text');

  return (
    <LocalPanelShell
      panelId={EXPLAINER_PANEL_ID}
      icon={<InfoIcon />}
      title={t('c:getting_started')}
      headerActions={
        <Button variant="ghost" size="sm" className="font-normal opacity-70 hover:opacity-100" onClick={setAsSeen}>
          <span>{t('c:dont_show_again')}</span>
        </Button>
      }
    >
      <ScrollArea id={'explainer-scrollarea'} className="h-full">
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
      </ScrollArea>
    </LocalPanelShell>
  );
}
