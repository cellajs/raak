import type { SVGProps } from 'react';
import { useTranslation } from 'react-i18next';

/** lucide's 1.5 in a 24-unit viewBox is 1.0 in this 16-unit one; 1.1 keeps the small glyphs from looking light. */
export const statusIconStrokeWidth = 1.1;

interface StatusIconFrameProps extends SVGProps<SVGSVGElement> {
  status: 'accepted' | 'reviewed' | 'delivered' | 'finished' | 'started' | 'unstarted' | 'iced';
}

/** A 1em svg titled with the translated status. */
export function StatusIconFrame({ status, children, ...props }: StatusIconFrameProps) {
  const { t } = useTranslation();
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label={t(`c:${status}`)} {...props}>
      <title>{t(`c:${status}`)}</title>
      {children}
    </svg>
  );
}
