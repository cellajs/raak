import { useTranslation } from 'react-i18next';
import type { TKey } from '~/lib/i18n-locales';
import { highlightItems } from '~/modules/marketing/marketing-config';
import { cn } from '~/utils/cn';

export function Highlights() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto mb-12 grid max-w-6xl gap-10 md:grid-cols-3 lg:mb-16">
      {highlightItems.map(({ id, icon: Icon, className }, index) => (
        <div key={id} className="flex flex-col gap-3">
          <span className={cn('flex size-11 items-center justify-center rounded-lg', className)}>
            <Icon className="size-5" />
          </span>
          <h3 className="mt-1 font-medium text-xl">{t(`about:highlights.title_${index + 1}` as TKey)}</h3>
          <p className="text-muted-foreground leading-relaxed">{t(`about:highlights.text_${index + 1}` as TKey)}</p>
        </div>
      ))}
    </div>
  );
}
