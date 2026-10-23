import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function FinishedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="finished" {...props}>
      <path d="M8 3.2H9.65a3.15 3.15 0 0 1 3.15 3.15V9.65a3.15 3.15 0 0 1-3.15 3.15H8Z" fill="#97C022" />
      <rect x="3.75" y="3.75" width="8.5" height="8.5" rx="2.6" fill="none" stroke="#97C022" strokeWidth={statusIconStrokeWidth} />
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.25" fill="none" stroke="#97C022" strokeWidth={statusIconStrokeWidth} />
    </StatusIconFrame>
  );
}
