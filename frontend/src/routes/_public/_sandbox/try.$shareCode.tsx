import { createFileRoute } from '@tanstack/react-router';
import i18n from 'i18next';
import { appConfig } from 'shared';
import { JoinSandboxPage } from '~/modules/sandbox/join-sandbox-page';
import { pageHead } from '~/utils/app-title';

export const Route = createFileRoute('/_public/_sandbox/try/$shareCode')({
  staticData: { isAuth: false },
  head: () => pageHead(i18n.t('c:sandbox_join', { appName: appConfig.name })),
  component: TryTogetherRoute,
});

function TryTogetherRoute() {
  const { shareCode } = Route.useParams();
  return <JoinSandboxPage shareCode={shareCode} />;
}
