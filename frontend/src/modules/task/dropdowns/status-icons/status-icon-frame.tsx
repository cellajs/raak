import type { SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import type { statusOptions } from '~/modules/task/task-properties';

/** The theme's lucide stroke, drawn in a 24-unit viewBox, scaled to this 16-unit one; 0.1 more keeps the small glyphs from looking light. */
export const statusIconStrokeWidth = (appConfig.theme.strokeWidth * 2) / 3 + 0.1;

interface StatusIconFrameProps extends SVGProps<SVGSVGElement> {
  statusName: (typeof statusOptions)[number]['name'];
}

/** A 1em svg titled with the translated status, untitled when aria-hidden. */
export function StatusIconFrame({ statusName, children, ...props }: StatusIconFrameProps) {
  const { t } = useTranslation();
  // A <title> is also a native tooltip, which doubles any tooltip around a decorative icon
  const label = props['aria-hidden'] ? undefined : t(`c:${statusName}`);
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label={label} {...props}>
      {label && <title>{label}</title>}
      {children}
    </svg>
  );
}
