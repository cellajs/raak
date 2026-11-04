import type { SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';

/** The theme's lucide stroke, drawn in a 24-unit viewBox, scaled to this 16-unit one; 0.1 more keeps the small glyphs from looking light. */
export const statusIconStrokeWidth = (appConfig.theme.strokeWidth * 2) / 3 + 0.1;

interface StatusIconFrameProps extends SVGProps<SVGSVGElement> {
  statusName: 'done' | 'reviewed' | 'delivered' | 'started' | 'unstarted' | 'iced';
}

/** A 1em svg titled with the translated status. */
export function StatusIconFrame({ statusName, children, ...props }: StatusIconFrameProps) {
  const { t } = useTranslation();
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label={t(`c:${statusName}`)} {...props}>
      <title>{t(`c:${statusName}`)}</title>
      {children}
    </svg>
  );
}
