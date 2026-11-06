import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveHero } from '~/modules/sandbox/live-hero';
import { lazyNamed } from '~/utils/lazy-named';

const DemoBoard = lazyNamed(() => import('~/modules/marketing/about/demo/demo-board'), 'DemoBoard');

/** The hero's board, playing by itself until the visitor takes it over as their sandbox. Its height keeps the whole frame, and on a phone the sheet at its foot, on the first screen. */
export function AboutDemo() {
  const { t } = useTranslation();

  return (
    <LiveHero
      label={t('about:demo_label')}
      caption={t('about:demo_caption')}
      className="bg-background ring-background/50 relative z-10 mx-auto h-(--demo-height) w-full max-w-6xl overflow-hidden rounded-xl border text-left shadow-2xl ring-6 [--demo-height:max(19rem,calc(100svh-20rem))] sm:p-3 sm:[--demo-height:max(25rem,min(38rem,calc(100dvh-18rem)))]"
      scripted={
        <Suspense fallback={null}>
          <DemoBoard />
        </Suspense>
      }
    />
  );
}
