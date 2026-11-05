import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function StartedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="started" {...props}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth={statusIconStrokeWidth} />
      <path d="M8 8V4.1A3.9 3.9 0 0 1 11.9 8Z" fill="currentColor" />
    </StatusIconFrame>
  );
}
