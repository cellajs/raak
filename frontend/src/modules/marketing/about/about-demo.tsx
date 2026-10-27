import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Spinner } from '~/modules/common/spinner';
import { aboutDemoProjectSlugs } from '~/modules/marketing/marketing-config';
import { lazyNamed } from '~/utils/lazy-named';

const PublicProjectsBoard = lazyNamed(() => import('~/modules/task/board/public-projects-board'), 'PublicProjectsBoard');

/** The hero's live board of the configured public projects. One that fails to load takes the whole frame out, not the page. */
export function AboutDemo() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary fallback={null}>
      <div className="relative z-10 mx-auto flex h-136 w-full max-w-6xl flex-col overflow-hidden rounded-xl border bg-background text-left shadow-2xl ring-6 ring-background/50 sm:h-152 sm:gap-2 sm:p-3">
        <Suspense fallback={<Spinner className="m-auto" />}>
          <PublicProjectsBoard boardId="about-demo" slugs={aboutDemoProjectSlugs} />
        </Suspense>
      </div>
      <p className="relative z-10 mt-4 text-center text-muted-foreground text-sm">{t('about:demo_caption')}</p>
    </ErrorBoundary>
  );
}
