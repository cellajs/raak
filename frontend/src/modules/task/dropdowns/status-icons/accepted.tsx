import type { SVGProps } from 'react';
import { StatusIconFrame } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function AcceptedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="accepted" {...props}>
      <rect x="0.7" y="0.7" width="14.6" height="14.6" rx="4.8" fill="#16A34A" />
      <path d="M4.9 8.2 7 10.3 11.2 5.6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </StatusIconFrame>
  );
}
