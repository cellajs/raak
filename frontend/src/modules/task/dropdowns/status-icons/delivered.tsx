import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function DeliveredIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="delivered" {...props}>
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4.25" fill="none" stroke="#F2BE00" strokeWidth={statusIconStrokeWidth} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        transform="translate(8 8) scale(1.17) translate(-8 -8)"
        d="M6 4v3.7c0 .1.1.2.2.1L8 6.4h.2l1.7 1.4h.2V3.8c1.2.3 2.1 1.4 2.1 2.7v2.9c0 1.4-1.2 2.6-2.6 2.6h-3A2.7 2.7 0 0 1 4 9.5v-3c0-1.2.9-2.3 2.1-2.6Z"
        fill="#F2BE00"
      />
    </StatusIconFrame>
  );
}
