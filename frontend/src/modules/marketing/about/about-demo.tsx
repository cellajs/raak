import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { lazyNamed } from '~/utils/lazy-named';

const DemoBoard = lazyNamed(() => import('~/modules/marketing/about/demo/demo-board'), 'DemoBoard');

/** The hero's board, playing by itself. Its height keeps the whole frame, and on a phone the sheet at its foot, on the first screen. */
export function AboutDemo() {
  const { t } = useTranslation();

  return (
    <>
      <div
        role="img"
        aria-label={t('about:demo_label')}
        className="relative z-10 mx-auto h-(--demo-height) w-full max-w-6xl overflow-hidden rounded-xl border bg-background text-left shadow-2xl ring-6 ring-background/50 [--demo-height:max(19rem,calc(100svh-20rem))] sm:p-3 sm:[--demo-height:max(25rem,min(38rem,calc(100dvh-18rem)))]"
      >
        <Suspense fallback={null}>
          <DemoBoard />
        </Suspense>
      </div>
      <p className="relative z-10 mt-4 text-center text-muted-foreground text-sm">{t('about:demo_caption')}</p>
    </>
  );
}
