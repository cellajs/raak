import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FlaskConicalIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { endSession } from '~/modules/auth/end-session';
import { sandboxQueryOptions } from '~/modules/sandbox/query';
import { isFramed, isSandboxAddress } from '~/modules/sandbox/sandbox-account';
import { useSandboxFrame, useSandboxView } from '~/modules/sandbox/sandbox-frame';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { dateShort } from '~/utils/date-short';

/**
 * On top of a sandbox account's board: what a sandbox is, when it is cleared, and the way out to a sign-in. Inside the
 * about page's frame it shows nothing, and the board stands alone.
 */
export function SandboxBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const framed = isFramed();
  const isSandbox = useUserStore((state) => isSandboxAddress(state.user?.email));
  const { data: sandbox } = useQuery({ ...sandboxQueryOptions(), enabled: isSandbox && !framed });
  useSandboxView(framed || isSandbox);
  useSandboxFrame(framed);

  if (framed || !isSandbox) return null;

  const signIn = async () => {
    await endSession({ wipe: true });
    navigate({ to: '/auth/authenticate' });
  };

  return (
    // A focus view container, which focus view keeps in view above the board
    <Alert variant="info" className="focus-view-container rounded-none border-0 border-b">
      <FlaskConicalIcon />
      <AlertTitle>{t('c:sandbox_bar')}</AlertTitle>
      <AlertDescription>{t('c:sandbox_bar.text', { date: dateShort(sandbox?.expiresAt) ?? '' })}</AlertDescription>
      <AlertAction>
        <Button size="sm" onClick={signIn}>
          {t('c:sign_in')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
