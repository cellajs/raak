import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { meQueryOptions } from '~/modules/me/query';
import { useSandboxClaimMutation } from '~/modules/sandbox/query';
import { frameReadyMessage } from '~/modules/sandbox/sandbox-account';
import { Button, buttonVariants } from '~/modules/ui/button';
import { queryClient } from '~/query/query-client';
import { cn } from '~/utils/cn';

type HeroState = 'scripted' | 'claiming' | 'loading' | 'live' | 'unavailable';

/** How long a frame may take to report its layout before the scripted board stays. */
const frameTimeoutMs = 15_000;
/** The board in the frame fills in after its layout reports, so the fade waits for it. */
const settleMs = 600;

interface LiveHeroProps {
  /** Shown until the sandbox is live, and for good when none can be had. */
  scripted: ReactNode;
  className: string;
  label: string;
  caption: string;
}

/**
 * The about page's board, which becomes the visitor's own sandbox: the scripted board plays until the visitor moves
 * onto it or presses Try it yourself, then the sandbox's own workspace fades in, the app itself in a frame. On a phone
 * the press opens the sandbox full screen, as a frame would catch the thumb that scrolls the page.
 */
export function LiveHero({ scripted, className, label, caption }: LiveHeroProps) {
  const { t } = useTranslation();
  const isPhone = useBreakpointBelow('sm');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<HeroState>('scripted');
  const [path, setPath] = useState<string>();
  const [settled, setSettled] = useState(false);
  const { mutateAsync: claimSandbox } = useSandboxClaimMutation();

  const claim = async () => {
    if (path) return path;
    if (state !== 'scripted') return;
    setState('claiming');
    try {
      const sandbox = await claimSandbox();
      // The frame's app reads the account from the stored user, so it opens without a sign-in round
      await queryClient.fetchQuery(meQueryOptions());
      setPath(sandbox.path);
      setState('loading');
      return sandbox.path;
    } catch {
      setState('unavailable');
    }
  };

  const tryIt = async () => {
    const opened = await claim();
    if (opened && isPhone) window.location.assign(opened);
  };

  useEffect(() => {
    if (state !== 'loading') return;
    let settle: number | undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === frameReadyMessage) settle = window.setTimeout(() => setState('live'), settleMs);
    };
    window.addEventListener('message', onMessage);
    const giveUp = window.setTimeout(() => setState((current) => (current === 'loading' ? 'unavailable' : current)), frameTimeoutMs);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(giveUp);
      window.clearTimeout(settle);
    };
  }, [state]);

  useEffect(() => {
    if (state !== 'live') return;
    const unmountScripted = window.setTimeout(() => setSettled(true), 500);
    return () => window.clearTimeout(unmountScripted);
  }, [state]);

  const live = state === 'live';
  const pending = state === 'claiming' || state === 'loading';

  return (
    <>
      <div
        role={live ? undefined : 'img'}
        aria-label={live ? undefined : label}
        className={className}
        onPointerEnter={isPhone ? undefined : () => void claim()}
      >
        {!settled && scripted}
        {path && !isPhone && state !== 'unavailable' && (
          <iframe
            ref={frameRef}
            src={path}
            title={t('c:your_sandbox')}
            className={cn('bg-background absolute inset-0 size-full opacity-0 transition-opacity duration-500', live && 'opacity-100')}
          />
        )}
      </div>
      <div className="text-muted-foreground relative z-10 mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm">
        {live && path ? (
          <>
            <span>{t('c:live_sandbox.text')}</span>
            <a href={path} target="_top" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
              {t('c:open_full_window')}
            </a>
          </>
        ) : (
          <>
            <span>{caption}</span>
            {state !== 'unavailable' && (
              <Button size="sm" variant="secondary" loading={pending} onClick={() => void tryIt()}>
                {t('c:try_it_yourself')}
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
