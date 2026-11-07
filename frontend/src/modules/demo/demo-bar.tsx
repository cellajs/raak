import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FlaskConicalIcon, ShrinkIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { endSession } from '~/modules/auth/end-session';
import { isDemoAddress, isFramed } from '~/modules/demo/demo-account';
import { useDemoFrame, useDemoView } from '~/modules/demo/demo-frame';
import { DemoShare } from '~/modules/demo/demo-share';
import { demoQueryOptions } from '~/modules/demo/query';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { cn } from '~/utils/cn';
import { dateShort } from '~/utils/date-short';

interface DemoAlertProps {
  expiresAt: string | null;
  shareCode?: string;
  /** Leaves the about page's full window; without it the alert offers no way back. */
  onClose?: () => void;
  className?: string;
}

/** What a demo is, when it is cleared, its link for a colleague, and the way out to a sign-in. */
export function DemoAlert({ expiresAt, shareCode, onClose, className }: DemoAlertProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const signIn = async () => {
    await endSession({ wipe: true });
    navigate({ to: '/auth/authenticate' });
  };

  return (
    <Alert variant="info" className={cn('rounded-none border-0 border-b', className)}>
      <FlaskConicalIcon />
      <AlertTitle>{t('c:demo_bar')}</AlertTitle>
      <AlertDescription className="max-sm:hidden">{t('c:demo_bar.text', { date: dateShort(expiresAt) ?? '' })}</AlertDescription>
      <AlertAction className="flex gap-2">
        {shareCode && expiresAt && (
          <DemoShare
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
 * On top of the app for a demo account, which nothing links to any more (the about page opens the full window in
 * place), but which a typed address or the sign-in page's redirect still reaches. Inside the about page's frame it
 * shows nothing, and the board stands alone.
 */
export function DemoBar() {
  const framed = isFramed();
  const isDemo = useUserStore((state) => isDemoAddress(state.user?.email));
  const { data: demo } = useQuery({ ...demoQueryOptions(), enabled: isDemo && !framed });
  useDemoView(framed || isDemo);
  useDemoFrame(framed);

  if (framed || !isDemo) return null;

  // A focus view container, which focus view keeps in view above the board
  return <DemoAlert expiresAt={demo?.expiresAt ?? null} shareCode={demo?.shareCode} className="focus-view-container" />;
}
