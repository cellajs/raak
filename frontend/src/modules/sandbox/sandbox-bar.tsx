import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FlaskConicalIcon, ShrinkIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { endSession } from '~/modules/auth/end-session';
import { sandboxQueryOptions } from '~/modules/sandbox/query';
import { isFramed, isSandboxAddress } from '~/modules/sandbox/sandbox-account';
import { useSandboxFrame, useSandboxView } from '~/modules/sandbox/sandbox-frame';
import { SandboxShare } from '~/modules/sandbox/sandbox-share';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { cn } from '~/utils/cn';
import { dateShort } from '~/utils/date-short';

interface SandboxAlertProps {
  expiresAt: string | null;
  shareCode?: string;
  /** Leaves the about page's full window; without it the alert offers no way back. */
  onClose?: () => void;
  className?: string;
}

/** What a sandbox is, when it is cleared, its link for a colleague, and the way out to a sign-in. */
export function SandboxAlert({ expiresAt, shareCode, onClose, className }: SandboxAlertProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const signIn = async () => {
    await endSession({ wipe: true });
    navigate({ to: '/auth/authenticate' });
  };

  return (
    <Alert variant="info" className={cn('rounded-none border-0 border-b', className)}>
      <FlaskConicalIcon />
      <AlertTitle>{t('c:sandbox_bar')}</AlertTitle>
      <AlertDescription className="max-sm:hidden">{t('c:sandbox_bar.text', { date: dateShort(expiresAt) ?? '' })}</AlertDescription>
      <AlertAction className="flex gap-2">
        {shareCode && expiresAt && (
          <SandboxShare
            shareCode={shareCode}
            expiresAt={expiresAt}
            trigger={
              <Button size="sm">
                <UsersIcon />
                {t('c:try_together')}
              </Button>
            }
          />
        )}
        <Button size="sm" variant="outline" onClick={signIn}>
          {t('c:sign_in')}
        </Button>
        {onClose && (
          <Button size="sm" variant="outline" onClick={onClose} aria-label={t('c:leave_full_window')}>
            <ShrinkIcon />
            <span className="max-sm:hidden">{t('c:leave_full_window')}</span>
          </Button>
        )}
      </AlertAction>
    </Alert>
  );
}

/**
 * On top of the app for a sandbox account, which nothing links to any more (the about page opens the full window in
 * place), but which a typed address or the sign-in page's redirect still reaches. Inside the about page's frame it
 * shows nothing, and the board stands alone.
 */
export function SandboxBar() {
  const framed = isFramed();
  const isSandbox = useUserStore((state) => isSandboxAddress(state.user?.email));
  const { data: sandbox } = useQuery({ ...sandboxQueryOptions(), enabled: isSandbox && !framed });
  useSandboxView(framed || isSandbox);
  useSandboxFrame(framed);

  if (framed || !isSandbox) return null;

  // A focus view container, which focus view keeps in view above the board
  return <SandboxAlert expiresAt={sandbox?.expiresAt ?? null} shareCode={sandbox?.shareCode} className="focus-view-container" />;
}
