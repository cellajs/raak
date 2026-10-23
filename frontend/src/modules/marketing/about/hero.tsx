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
  children: React.ReactNode;
  text?: AboutKey;
}

export function Hero({ title, text, children }: HeroProps) {
  const { t } = useTranslation();
  const theme = useUIStore((state) => state.theme);
  const { ref, inView } = useInView({ once: true, threshold: 0.5 });

  // When a theme color is active, derive gradient from --primary CSS variable so any color in appConfig.theme.colors works automatically
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
    <section id="spy-welcome" className="rich-gradient relative flex min-h-[90vh] items-center justify-center px-4 py-24 lg:py-32">
      <header
        ref={ref}
        className={cn(
          'container flex max-w-4xl flex-col items-center gap-4 text-center transition-all duration-500 ease-out will-change-transform',
          !inView && 'translate-y-4 scale-95 opacity-0',
        )}
      >
        <h1 className="mb-6 font-heading text-3xl leading-10 sm:mt-6 sm:text-4xl sm:leading-13 md:text-5xl md:leading-18 lg:text-6xl">
          <span className={cn('whitespace-pre-line bg-linear-to-br bg-clip-text font-bold', gradientClass)} style={gradientStyle}>
            {t(title)}
          </span>
        </h1>
        {text && (
          <h2 className="mx-auto mb-8 max-w-4xl text-foreground/90 text-xl leading-8 md:text-2xl md:leading-10">
            <Trans t={t} i18nKey={text} components={{ em: <em />, strong: <strong /> }} />
          </h2>
        )}
        <div>{children}</div>
      </header>
      <BackgroundCurve />
    </section>
  );
}
