import { useTranslation } from 'react-i18next';
import { LiveHero } from '~/modules/demo/live-hero';

const stills = '/static/marketing/hero';

/** One theme's picture of a new demo's board, the phone's below the `sm` breakpoint. */
function Still({ theme, className }: { theme: 'light' | 'dark'; className: string }) {
  const suffix = theme === 'dark' ? '-dark' : '';
  return (
    <picture className={className}>
      <source media="(max-width: 639px)" srcSet={`${stills}/board-phone${suffix}.webp`} />
      <img src={`${stills}/board${suffix}.webp`} alt="" fetchPriority="high" className="size-full object-cover object-left-top" />
    </picture>
  );
}

/** The hero's board: a picture of a new demo until the visitor takes it over as their own. Its height keeps the whole frame on the first screen. */
export function AboutDemo() {
  const { t } = useTranslation();

  return (
    <LiveHero
      label={t('about:demo_label')}
      className="bg-background ring-background/50 relative z-10 mx-auto h-(--demo-height) w-full max-w-6xl overflow-hidden rounded-xl border text-left shadow-2xl ring-6 [--demo-height:max(19rem,calc(100svh-20rem))] sm:[--demo-height:max(25rem,min(38rem,calc(100dvh-18rem)))]"
      still={
        <>
          <Still theme="light" className="block size-full dark:hidden" />
          <Still theme="dark" className="hidden size-full dark:block" />
        </>
      }
    />
  );
}
