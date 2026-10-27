import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useInView } from '~/hooks/use-in-view';
import type { TKey } from '~/lib/i18n-locales';
import { BackgroundCurve } from '~/modules/marketing/background-curve';
import { useUIStore } from '~/modules/ui/ui-store';
import { cn } from '~/utils/cn';

// Narrowed to the `about` namespace: <Trans> re-derives its return type from the full key
// union, and the unnarrowed TKey union is too large for that to typecheck (TS2590).
type AboutKey = Extract<TKey, `about:${string}`>;

interface HeroProps {
  title: TKey;
  children: ReactNode;
  text?: AboutKey;
  /** Shown below the call to action, its lower part over the page background past the curve. */
  demo?: ReactNode;
}

export function Hero({ title, text, children, demo }: HeroProps) {
  const { t } = useTranslation();
  const theme = useUIStore((state) => state.theme);
  const { ref, inView } = useInView({ once: true, threshold: 0.5 });

  // The gradient derives from --primary, so any color in appConfig.theme.colors works
  const hasTheme = theme !== 'none';
  const gradientClass = hasTheme ? 'text-transparent' : 'from-slate-200 via-neutral-200 to-stone-300 text-primary/90';
  const gradientStyle = hasTheme
    ? {
        backgroundImage: `linear-gradient(to bottom right,
          color-mix(in oklch, var(--primary), black 30%),
          var(--primary),
          color-mix(in oklch, var(--primary), black 20%))`,
      }
    : undefined;

  return (
    <section
      id="spy-welcome"
      className={cn(
        'rich-gradient relative flex flex-col items-center px-4',
        demo ? 'pt-24 pb-12 lg:pt-32' : 'min-h-[90vh] justify-center py-24 lg:py-32',
      )}
    >
      <header
        ref={ref}
        className={cn(
          'container flex max-w-4xl flex-col items-center gap-4 text-center transition-[opacity,translate,scale] duration-500 ease-out',
          !inView && 'translate-y-4 scale-95 opacity-0',
        )}
      >
        <h1 className="mb-6 font-heading text-3xl leading-10 sm:mt-6 sm:text-4xl sm:leading-13 md:text-5xl md:leading-18 lg:text-6xl">
          <span className={cn('whitespace-pre-line bg-linear-to-br bg-clip-text font-bold', gradientClass)} style={gradientStyle}>
            {t(title)}
          </span>
        </h1>
        {text && (
          <h2 className="mb-8 text-foreground/90 text-xl leading-8 md:text-2xl md:leading-10">
            <Trans t={t} i18nKey={text} components={{ em: <em />, strong: <strong /> }} />
          </h2>
        )}
        <div>{children}</div>
      </header>
      {demo ? (
        <>
          <div className="mt-12 w-full lg:mt-16">{demo}</div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-80 bg-background sm:h-96">
            <div className="absolute inset-x-0 bottom-full">
              <BackgroundCurve />
            </div>
          </div>
        </>
      ) : (
        <BackgroundCurve />
      )}
    </section>
  );
}
