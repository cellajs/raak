import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function StartedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="started" {...props}>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.25" fill="none" stroke="currentColor" strokeWidth={statusIconStrokeWidth} />
      <rect x="3.75" y="3.75" width="8.5" height="8.5" rx="2.6" fill="none" stroke="currentColor" strokeWidth={statusIconStrokeWidth} />
      <path d="M8 3.2H9.65a3.15 3.15 0 0 1 3.15 3.15V8H8Z" fill="currentColor" />
    </StatusIconFrame>
  );
}
