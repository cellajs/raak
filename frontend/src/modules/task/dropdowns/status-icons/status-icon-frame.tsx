import type { SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

/** Stroke width of the status icons in their 16-unit viewBox: lucide's 1.5 in a 24-unit one is 1.0 here, nudged heavier so the small glyphs hold weight next to outline icons. */
export const statusIconStrokeWidth = 1.1;

interface StatusIconFrameProps extends SVGProps<SVGSVGElement> {
  status: 'accepted' | 'reviewed' | 'delivered' | 'finished' | 'started' | 'unstarted' | 'iced';
}

/** The svg shell shared by the status icons: a 1em square that carries the translated status as its title. */
export function StatusIconFrame({ status, children, ...props }: StatusIconFrameProps) {
  const { t } = useTranslation();
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label={t(`c:${status}`)} {...props}>
      <title>{t(`c:${status}`)}</title>
      {children}
    </svg>
  );
}
