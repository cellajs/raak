import { FlaskConicalIcon, Maximize2Icon, UsersIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { Spinner } from '~/modules/common/spinner';
import { enterSandbox } from '~/modules/sandbox/first-view';
import { useSandboxClaimMutation } from '~/modules/sandbox/query';
import { isSandboxFrameMessage, sandboxFrameMessage } from '~/modules/sandbox/sandbox-account';
import { SandboxShare } from '~/modules/sandbox/sandbox-share';
import { cn } from '~/utils/cn';

type HeroState = 'still' | 'claiming' | 'loading' | 'live' | 'unavailable';
type Hint = 'passive' | 'engaged';

/** How long a frame may take to report its layout before the still stays. */
const frameTimeoutMs = 15_000;
/** The board in the frame fills in after its layout reports, so the fade waits for it. */
const settleMs = 600;
/** The card explains the board at least this long, which covers most of the wait for it. */
const cardMs = 3_000;
const hintMs = 2_500;

const pillButtonClass = 'bg-background/15 hover:bg-background/25 inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-medium';

interface LiveHeroProps {
  /** The sandbox's first view as a picture: shown until the sandbox is live, and for good when none can be had. */
  still: ReactNode;
  className: string;
  label: string;
}

/**
 * The about page's board, which becomes the visitor's own sandbox: a picture of its first view until the visitor moves
 * onto it, then a card that says what it is while the sandbox's workspace loads behind it, the app itself in a frame.
 * The frame hands the wheel to the page until the visitor presses inside it. On a phone the pill opens the sandbox
 * full screen, as a frame would catch the thumb that scrolls the page.
 */
export function LiveHero({ still, className, label }: LiveHeroProps) {
  const { t } = useTranslation();
  const isPhone = useBreakpointBelow('sm');
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const claiming = useRef<Promise<string | undefined>>(undefined);
  const hintsShown = useRef(new Set<Hint>());
  const [state, setState] = useState<HeroState>('still');
  const [entry, setEntry] = useState<{ path: string; shareCode: string; expiresAt: string | null }>();
  const [cardOpen, setCardOpen] = useState(false);
  const [cardLong, setCardLong] = useState(false);
  const [stillGone, setStillGone] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [hint, setHint] = useState<Hint>();
  const { mutateAsync: claimSandbox } = useSandboxClaimMutation();

  const path = entry?.path;
  const live = state === 'live';
  // Hints wait for the board itself: live, and the card gone
  const hintsAllowed = useLatestRef(live && (!cardOpen || cardLong));

  const claim = () => {
    if (claiming.current) return claiming.current;
    claiming.current = (async () => {
      setState('claiming');
      try {
        const sandbox = await claimSandbox();
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

  const lookAt = () => {
    if (isPhone || claiming.current) return;
    setCardOpen(true);
    void claim();
  };

  const openFull = async () => {
    const opened = await claim();
    if (opened) window.location.assign(opened);
  };

  const showHint = (kind: Hint) => {
    if (!hintsAllowed.current || hintsShown.current.has(kind)) return;
    hintsShown.current.add(kind);
    setHint(kind);
    window.setTimeout(() => setHint((current) => (current === kind ? undefined : current)), hintMs);
  };

  useEffect(() => {
    if (!cardOpen) return;
    const long = window.setTimeout(() => setCardLong(true), cardMs);
    return () => window.clearTimeout(long);
  }, [cardOpen]);

  useEffect(() => {
    if (!path || isPhone) return;
    let settle: number | undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isSandboxFrameMessage(event.data)) return;
      const message = event.data;
      if (message.kind === 'ready') settle = window.setTimeout(() => setState((current) => (current === 'loading' ? 'live' : current)), settleMs);
      if (message.kind === 'wheel') {
        window.scrollBy({ left: message.deltaX, top: message.deltaY, behavior: 'instant' });
        showHint('passive');
      }
      if (message.kind === 'engaged') {
        setEngaged(true);
        showHint('engaged');
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(settle);
    };
  }, [path, isPhone]);

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
    if (!engaged) return;
    const release = () => {
      frameRef.current?.contentWindow?.postMessage({ type: sandboxFrameMessage, kind: 'release' }, window.location.origin);
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
  }, [engaged]);

  const unavailable = state === 'unavailable';
  const cardVisible = cardOpen && !unavailable && !(live && cardLong);
  const pending = state === 'claiming' || (isPhone && state === 'loading');

  return (
    <div ref={boxRef} className={className} onPointerEnter={lookAt}>
      <div role={live ? 'region' : 'img'} aria-label={live ? t('c:your_sandbox') : label} className="absolute inset-0">
        {!stillGone && still}
        {path && !isPhone && !unavailable && (
          <iframe
            ref={frameRef}
            src={path}
            title={t('c:your_sandbox')}
            className={cn('bg-background absolute inset-0 size-full opacity-0 transition-opacity duration-500', live && 'opacity-100')}
          />
        )}
      </div>

      {engaged && <div aria-hidden className="ring-foreground/70 pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-2 ring-inset" />}

      <div
        aria-hidden={!cardVisible}
        className={cn(
          'bg-background/60 pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4 opacity-0 transition-opacity duration-500',
          cardVisible && 'opacity-100',
        )}
      >
        <section role="status" className="bg-card text-card-foreground flex w-full max-w-md flex-col gap-3 rounded-xl border p-6 text-left shadow-xl">
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
        </section>
      </div>

      {hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-18 z-20 flex justify-center px-4">
          <span className="bg-foreground text-background rounded-full px-3.5 py-2 text-sm font-medium shadow-lg">
            {t(`c:sandbox_scroll.${hint}`)}
          </span>
        </div>
      )}

      {!unavailable && (
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
            {path && !isPhone ? (
              <a href={path} target="_top" className={pillButtonClass}>
                {t('c:open_full_window')}
                <Maximize2Icon className="size-4" />
              </a>
            ) : (
              <button type="button" disabled={pending} onClick={() => void openFull()} className={pillButtonClass}>
                {t('c:open_full_window')}
                {pending ? <Spinner className="size-4" noDelay /> : <Maximize2Icon className="size-4" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
