import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { useInView } from '~/hooks/use-in-view';
import type { TKey } from '~/lib/i18n-locales';
import { BackgroundCurve } from '~/modules/marketing/background-curve';
import { useUIStore } from '~/modules/ui/ui-store';
import { cn } from '~/utils/cn';

interface HeroProps {
  title: TKey;
  text: TKey;
  /** Shown below the text, its lower part over the page background past the curve. */
  demo: ReactNode;
}

export function Hero({ title, text, demo }: HeroProps) {
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
    <section id="spy-welcome" className="rich-gradient relative flex flex-col items-center px-3 pt-20 pb-12 sm:px-4 sm:pt-24">
      <header
        ref={ref}
        className={cn(
          'flex w-full max-w-4xl flex-col items-center gap-2 text-center transition-[opacity,translate,scale] duration-500 ease-out',
          !inView && 'translate-y-4 scale-95 opacity-0',
        )}
      >
        <h1 className="font-heading text-2xl leading-8 sm:text-4xl sm:leading-13 lg:text-5xl lg:leading-15 lg:*:whitespace-normal">
          <span className={cn('bg-linear-to-br bg-clip-text font-bold whitespace-pre-line', gradientClass)} style={gradientStyle}>
            {t(title)}
          </span>
        </h1>
        <p className="text-foreground text-balance sm:text-lg lg:text-xl">{t(text)}</p>
      </header>
      {/* One boundary for the demo and the block behind it: without the demo the block would cover the text */}
      <ErrorBoundary
        fallback={
          <>
            <div className="h-[40vh]" />
            <BackgroundCurve />
          </>
        }
      >
        <div className="mt-8 w-full lg:mt-10">{demo}</div>
        <div aria-hidden className="bg-background absolute inset-x-0 bottom-0 h-80 sm:h-96">
          <div className="absolute inset-x-0 bottom-full">
            <BackgroundCurve />
          </div>
        </div>
      </ErrorBoundary>
    </section>
  );
}
