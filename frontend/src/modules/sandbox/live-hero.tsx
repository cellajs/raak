import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { FlaskConicalIcon, Maximize2Icon, UsersIcon } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { endSession } from '~/modules/auth/end-session';
import { Spinner } from '~/modules/common/spinner';
import { meQueryOptions } from '~/modules/me/query';
import { enterSandbox } from '~/modules/sandbox/first-view';
import { sandboxInviteQueryOptions, useSandboxClaimMutation, useSandboxJoinMutation } from '~/modules/sandbox/query';
import { isSandboxAddress, isSandboxFrameMessage, sandboxFrameMessage } from '~/modules/sandbox/sandbox-account';
import { SandboxAlert } from '~/modules/sandbox/sandbox-bar';
import { useSandboxView } from '~/modules/sandbox/sandbox-frame';
import { refusalOf, SandboxInviteCard } from '~/modules/sandbox/sandbox-invite-card';
import { SandboxShare } from '~/modules/sandbox/sandbox-share';
import { cn } from '~/utils/cn';

type HeroState = 'still' | 'claiming' | 'loading' | 'live' | 'unavailable';

/** How long a frame may take to report its layout before the still stays. */
const frameTimeoutMs = 15_000;
/** The board in the frame fills in after its layout reports, so the fade waits for it. */
const settleMs = 600;
/** The card explains the board at least this long, which covers most of the wait for it. */
const cardMs = 3_000;

const pillButtonClass = 'bg-background/15 hover:bg-background/25 inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-medium';
const fullWindowClass = 'fixed inset-0 z-50 h-dvh max-w-none rounded-none border-0 shadow-none ring-0';

const aboutRoute = getRouteApi('/_public/_marketing/about');

interface LiveHeroProps {
  /** The sandbox's first view as a picture: shown until the sandbox is live, and for good when none can be had. */
  still: ReactNode;
  className: string;
  label: string;
}

/**
 * The about page's board, which becomes the visitor's own sandbox: a picture of its first view until the visitor moves
 * onto it, then a card that says what it is while the sandbox's workspace loads behind it, the app itself in a frame.
 * A browser that holds a sandbox gets it back on arrival, and the page's address then carries its share code. That
 * address (`?sandbox=<code>`) lets a colleague in: the card asks their first name instead.
 *
 * The frame hands the wheel to the page until the visitor presses inside it, which a line under the board says. The
 * full window is this board in focus view, filling the window: on a phone the only way to it, as a frame in the page
 * would catch the thumb that scrolls.
 */
export function LiveHero({ still, className, label }: LiveHeroProps) {
  const { t } = useTranslation();
  const isPhone = useBreakpointBelow('sm');
  const navigate = aboutRoute.useNavigate();
  const shareCode = aboutRoute.useSearch({ select: (search) => search.sandbox });
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const claiming = useRef<Promise<string | undefined>>(undefined);
  const [state, setState] = useState<HeroState>('still');
  const [entry, setEntry] = useState<{ path: string; shareCode: string; expiresAt: string | null }>();
  const [cardOpen, setCardOpen] = useState(false);
  const [cardLong, setCardLong] = useState(false);
  const [stillGone, setStillGone] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [full, setFull] = useState(false);
  const [joining, setJoining] = useState(false);
  const { mutateAsync: claimSandbox } = useSandboxClaimMutation();
  const { mutateAsync: joinSandbox, error: joinError } = useSandboxJoinMutation();
  // The public layout asks `/me`, which is never stored: an answer means this page load found the session alive
  const { data: me } = useQuery({ ...meQueryOptions(), enabled: false });
  const {
    data: invite,
    error: inviteError,
    refetch: refetchInvite,
  } = useQuery({
    ...sandboxInviteQueryOptions(shareCode ?? ''),
    enabled: !!shareCode,
  });
  useSandboxView(full);

  const holdsSandbox = isSandboxAddress(me?.email);
  const path = entry?.path;
  const live = state === 'live';
  const unavailable = state === 'unavailable';
  const frameShown = !isPhone || full;
  const fullRef = useLatestRef(full);

  // A link into a sandbox this browser is not in: the card asks to join it, or says why it cannot
  const linked = !!shareCode && !entry && !invite?.joined;
  const refusal = linked && !joining ? (refusalOf(inviteError) ?? (invite?.full ? 'sandbox_full' : refusalOf(joinError))) : undefined;
  const asking = !!shareCode && !live && (joining || (linked && !!invite && !refusal));
  const explaining = cardOpen && !unavailable && !(live && cardLong);
  const cardVisible = asking || !!refusal || explaining;
  const interactive = asking || !!refusal;

  const holdWheel = (hold: boolean) =>
    frameRef.current?.contentWindow?.postMessage({ type: sandboxFrameMessage, kind: hold ? 'hold' : 'release' }, window.location.origin);

  const claim = () => {
    if (claiming.current) return claiming.current;
    claiming.current = (async () => {
      setState('claiming');
      try {
        const sandbox = await claimSandbox();
        if (!sandbox.claimed) setCardOpen(false);
        await enterSandbox(sandbox);
        setEntry(sandbox);
        setState('loading');
        return sandbox.path;
      } catch {
        setState('unavailable');
      }
    })();
    return claiming.current;
  };

  const join = (firstName: string) => {
    if (!shareCode || claiming.current) return;
    setJoining(true);
    claiming.current = (async () => {
      try {
        if (me) await endSession({ wipe: true });
        const sandbox = await joinSandbox({ shareCode, firstName });
        await enterSandbox(sandbox);
        setEntry(sandbox);
        setState('loading');
        if (isPhone) setFull(true);
        return sandbox.path;
      } catch {
        claiming.current = undefined;
        setJoining(false);
        void refetchInvite();
      }
    })();
  };

  const lookAt = () => {
    if (isPhone || claiming.current || linked) return;
    setCardOpen(true);
    void claim();
  };

  const openFull = async () => {
    if (!entry) setCardOpen(true);
    if (await claim()) setFull(true);
  };

  const closeFull = () => {
    setFull(false);
    setEngaged(false);
  };

  const dropLink = () => navigate({ search: {}, replace: true, resetScroll: false });

  // A browser back at its sandbox opens it at once, without the card it has seen
  const reopen = useEffectEvent(() => void claim());
  useEffect(() => {
    if (holdsSandbox && !isPhone && !linked) reopen();
  }, [holdsSandbox, isPhone, linked]);

  // The address carries the share code of the sandbox on the board, so copying it shares the sandbox
  useEffect(() => {
    if (!entry || shareCode === entry.shareCode) return;
    navigate({ search: { sandbox: entry.shareCode }, replace: true, resetScroll: false });
  }, [entry, shareCode, navigate]);

  useEffect(() => {
    if (!cardOpen) return;
    const long = window.setTimeout(() => setCardLong(true), cardMs);
    return () => window.clearTimeout(long);
  }, [cardOpen]);

  useEffect(() => {
    if (!path) return;
    let settle: number | undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isSandboxFrameMessage(event.data)) return;
      const message = event.data;
      if (message.kind === 'ready') {
        if (fullRef.current) holdWheel(true);
        window.clearTimeout(settle);
        settle = window.setTimeout(() => setState((current) => (current === 'loading' ? 'live' : current)), settleMs);
      }
      if (message.kind === 'wheel') window.scrollBy({ left: message.deltaX, top: message.deltaY, behavior: 'instant' });
      if (message.kind === 'engaged') setEngaged(true);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(settle);
    };
  }, [path]);

  // The full window has no page to scroll, so the frame keeps the wheel until the visitor leaves it
  useEffect(() => {
    if (!full) return;
    holdWheel(true);
    return () => holdWheel(false);
  }, [full]);

  useEffect(() => {
    if (state !== 'loading') return;
    const giveUp = window.setTimeout(() => setState((current) => (current === 'loading' ? 'unavailable' : current)), frameTimeoutMs);
    return () => window.clearTimeout(giveUp);
  }, [state]);

  useEffect(() => {
    if (!live) return;
    const unmountStill = window.setTimeout(() => setStillGone(true), 500);
    return () => window.clearTimeout(unmountStill);
  }, [live]);

  // A press on the page, or the board scrolled out of view, gives the wheel back to the page
  useEffect(() => {
    if (!engaged || full) return;
    const release = () => {
      holdWheel(false);
      setEngaged(false);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) release();
    });
    if (boxRef.current) observer.observe(boxRef.current);
    document.addEventListener('pointerdown', release);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', release);
    };
  }, [engaged, full]);

  const pending = state === 'claiming' || (isPhone && state === 'loading');
  // A phone keeps the frame once it has been live in the full window, so going back to it is instant
  const frameMounted = !!path && !unavailable && (!isPhone || full || stillGone);

  return (
    <>
      <div ref={boxRef} className={cn(className, 'focus-view-container flex flex-col', full && fullWindowClass)} onPointerEnter={lookAt}>
        {full && <SandboxAlert expiresAt={entry?.expiresAt ?? null} shareCode={entry?.shareCode} onClose={closeFull} />}

        <div role={live ? 'region' : 'img'} aria-label={live ? t('c:your_sandbox') : label} className="relative min-h-0 flex-1">
          {(!stillGone || !frameShown) && still}
          {frameMounted && (
            <iframe
              ref={frameRef}
              src={path}
              title={t('c:your_sandbox')}
              className={cn(
                'bg-background absolute inset-0 size-full opacity-0 transition-opacity duration-500',
                live && 'opacity-100',
                !frameShown && 'invisible',
              )}
            />
          )}
        </div>

        {engaged && !full && (
          <div aria-hidden className="ring-foreground/70 pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-2 ring-inset" />
        )}

        <div
          aria-hidden={!cardVisible}
          inert={!cardVisible}
          className={cn(
            'bg-background/60 pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 opacity-0 transition-opacity duration-500',
            cardVisible && 'opacity-100',
          )}
        >
          <section
            role={interactive ? undefined : 'status'}
            className={cn(
              'bg-card text-card-foreground flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl border p-5 text-left shadow-xl sm:p-6',
              interactive && cardVisible && 'pointer-events-auto',
            )}
          >
            {interactive ? (
              <SandboxInviteCard invite={invite} refusal={refusal} account={me} joining={joining} onJoin={join} onOwn={dropLink} />
            ) : (
              <>
                <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                  <FlaskConicalIcon className="size-5" />
                  {t('c:your_sandbox')}
                </h2>
                <p className="text-[0.9375rem] leading-6">{t('c:sandbox_card.text')}</p>
                {cardLong && !live ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Spinner className="size-4" noDelay />
                    {t('c:sandbox_card.waiting')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="bg-muted h-0.5 overflow-hidden rounded-full">
                      <div
                        className={cn('bg-foreground h-full w-0 transition-[width] ease-linear', cardVisible && 'w-full')}
                        style={{ transitionDuration: `${cardMs}ms` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-sm">{t('c:sandbox_card.loading')}</span>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {!unavailable && !full && !linked && (
          // Above the about page's floating menu, which a phone shows over the board's foot
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-4 sm:bottom-4">
            <div className="bg-foreground text-background pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 shadow-lg">
              <FlaskConicalIcon className="size-4 shrink-0" />
              <span className="hidden text-sm font-medium sm:inline">{t('c:your_sandbox')}</span>
              {entry && live && (
                <SandboxShare
                  shareCode={entry.shareCode}
                  expiresAt={entry.expiresAt}
                  trigger={
                    <button type="button" className={pillButtonClass}>
                      <UsersIcon className="size-4" />
                      {t('c:try_together')}
                    </button>
                  }
                />
              )}
              <button type="button" disabled={pending} onClick={() => void openFull()} className={pillButtonClass}>
                {t('c:open_full_window')}
                {pending ? <Spinner className="size-4" noDelay /> : <Maximize2Icon className="size-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Positioned: the block behind the board's foot would paint over it */}
      {!isPhone && (
        <p
          aria-live="polite"
          className={cn(
            'text-muted-foreground relative z-10 mt-3 text-center text-sm opacity-0 transition-opacity duration-500',
            live && !full && 'opacity-100',
          )}
        >
          {t(engaged ? 'c:sandbox_scroll.engaged' : 'c:sandbox_scroll.passive')}
        </p>
      )}
    </>
  );
}
