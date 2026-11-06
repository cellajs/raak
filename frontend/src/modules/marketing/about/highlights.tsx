import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { TKey } from '~/lib/i18n-locales';
import { lazyNamed } from '~/utils/lazy-named';

const tiles = () => import('~/modules/marketing/about/highlights/highlight-tiles');

const highlightTiles = [
  { id: 'search', Tile: lazyNamed(tiles, 'SearchTile') },
  { id: 'co-edit', Tile: lazyNamed(tiles, 'CoEditTile') },
  { id: 'offline', Tile: lazyNamed(tiles, 'OfflineTile') },
];

export function Highlights() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto mb-12 grid max-w-md gap-12 lg:mb-16 lg:max-w-6xl lg:grid-cols-3 lg:gap-10">
      {highlightTiles.map(({ id, Tile }, index) => (
        <div key={id} className="flex min-w-0 flex-col gap-3">
          <Suspense fallback={<div className="h-64" />}>
            <Tile />
          </Suspense>
          <h3 className="mt-3 text-xl font-medium">{t(`about:highlights.title_${index + 1}` as TKey)}</h3>
          <p className="text-muted-foreground leading-relaxed">{t(`about:highlights.text_${index + 1}` as TKey)}</p>
        </div>
      ))}
    </div>
  );
}
