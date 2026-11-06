import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FlaskConicalIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { endSession } from '~/modules/auth/end-session';
import { openKeepSandboxDialog } from '~/modules/sandbox/keep-sandbox-form';
import { sandboxQueryOptions } from '~/modules/sandbox/query';
import { frameReadyMessage, isFramed, isSandboxAddress } from '~/modules/sandbox/sandbox-account';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { dateShort } from '~/utils/date-short';

/**
 * On top of every app page of a sandbox account: what a sandbox is, when it ends, and the ways out (keep it, or sign in
 * to an account). Inside the about page's frame it shows nothing and hides the app's chrome, so the board stands alone.
 */
export function SandboxBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const framed = isFramed();
  const isSandbox = useUserStore((state) => isSandboxAddress(state.user?.email));
  const { data: sandbox } = useQuery({ ...sandboxQueryOptions(), enabled: isSandbox && !framed });

  // On the root element: the page's focus view container owns the body's class, and the stored setting is shared with
  // every tab, so either would leave focus view on after the hero
  useEffect(() => {
    if (!framed) return;
    document.documentElement.classList.add('focus-view');
    window.parent.postMessage({ type: frameReadyMessage }, window.location.origin);
    return () => document.documentElement.classList.remove('focus-view');
  }, [framed]);

  if (framed || !isSandbox) return null;

  const signIn = async () => {
    await endSession({ wipe: true });
    navigate({ to: '/auth/authenticate' });
  };

  return (
    <Alert variant="info" className="rounded-none border-0 border-b">
      <FlaskConicalIcon />
      <AlertTitle>{t('c:sandbox_bar')}</AlertTitle>
      <AlertDescription>{t('c:sandbox_bar.text', { date: dateShort(sandbox?.expiresAt) ?? '' })}</AlertDescription>
      <AlertAction className="flex gap-2">
        <Button size="sm" onClick={({ currentTarget }) => openKeepSandboxDialog({ current: currentTarget })}>
          {t('c:keep_sandbox')}
        </Button>
        <Button size="sm" variant="ghost" onClick={signIn}>
          {t('c:sign_in')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
