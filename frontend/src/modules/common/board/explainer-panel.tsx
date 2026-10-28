import { useSuspenseQuery } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { Spinner } from '~/modules/common/spinner';
import { organizationQueryOptions } from '~/modules/organization/query';
import { Button } from '~/modules/ui/button';
import { ScrollArea } from '~/modules/ui/scroll-area';

/** Keys the persisted panel layout and collapse state, so the value is fixed. */
export const EXPLAINER_PANEL_ID = 'explainer';

export function ExplainerPanel() {
  const { t } = useTranslation();

  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  const setAlertSeen = useAlertStore((state) => state.setAlertSeen);

  return (
    <LocalPanelShell
      panelId={EXPLAINER_PANEL_ID}
      icon={<InfoIcon />}
      title={t('c:getting_started')}
      headerActions={
        <Button variant="ghost" size="sm" className="font-normal text-muted-foreground" onClick={() => setAlertSeen('welcome-text')}>
          <span>{t('c:dont_show_again')}</span>
        </Button>
      }
    >
      <ScrollArea className="h-full">
        <div className="select-text p-4">
          <Suspense fallback={<Spinner className="my-4" noDelay />}>
            <BlockNoteFullHtml
              id="board-explainer"
              defaultValue={organization.welcomeText || ''}
              className="inline leading-none"
              tenantId={tenantId}
              organizationId={organizationId}
            />
          </Suspense>
        </div>
      </ScrollArea>
    </LocalPanelShell>
  );
}
