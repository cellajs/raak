import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function ReviewedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="reviewed" {...props}>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.25" fill="none" stroke="#f97316" strokeWidth={statusIconStrokeWidth} />
      <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="3.15" fill="#f97316" />
    </StatusIconFrame>
  );
}
