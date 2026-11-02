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
  children: ReactNode;
  /** Shown below the call to action, its lower part over the page background past the curve. */
  demo?: ReactNode;
}

export function Hero({ title, children, demo }: HeroProps) {
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
        'rich-gradient relative flex flex-col items-center',
        demo ? 'px-3 pt-20 pb-12 sm:px-4 sm:pt-24' : 'min-h-[90vh] justify-center px-4 py-24 lg:py-32',
      )}
    >
      <header
        ref={ref}
        className={cn(
          'flex max-w-4xl flex-col items-center gap-4 text-center transition-[opacity,translate,scale] duration-500 ease-out',
          demo ? 'w-full' : 'container',
          !inView && 'translate-y-4 scale-95 opacity-0',
        )}
      >
        <h1
          className={cn(
            'font-heading',
            demo
              ? 'mb-2 text-2xl leading-8 sm:text-4xl sm:leading-13 lg:text-5xl lg:leading-15 lg:*:whitespace-normal'
              : 'mb-6 text-3xl leading-10 sm:mt-6 sm:text-4xl sm:leading-13 md:text-5xl md:leading-18 lg:text-6xl',
          )}
        >
          <span className={cn('whitespace-pre-line bg-linear-to-br bg-clip-text font-bold', gradientClass)} style={gradientStyle}>
            {t(title)}
          </span>
        </h1>
        <div>{children}</div>
      </header>
      {demo ? (
        // One boundary for the demo and the block behind it: without the demo the block would cover the call to action
        <ErrorBoundary
          fallback={
            <>
              <div className="h-[40vh]" />
              <BackgroundCurve />
            </>
          }
        >
          <div className="mt-8 w-full lg:mt-10">{demo}</div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-80 bg-background sm:h-96">
            <div className="absolute inset-x-0 bottom-full">
              <BackgroundCurve />
            </div>
          </div>
        </ErrorBoundary>
      ) : (
        <BackgroundCurve />
      )}
    </section>
  );
}
