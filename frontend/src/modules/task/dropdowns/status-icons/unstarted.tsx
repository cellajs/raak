import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';

export function UnstartedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame status="unstarted" {...props}>
      <rect
        x="1.25"
        y="1.25"
        width="13.5"
        height="13.5"
        rx="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth={statusIconStrokeWidth}
        strokeLinecap="round"
        strokeDasharray="0.01 2.4"
      />
      <rect
        x="3.75"
        y="3.75"
        width="8.5"
        height="8.5"
        rx="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={statusIconStrokeWidth}
        strokeLinecap="round"
        strokeDasharray="0.01 1.8"
      />
    </StatusIconFrame>
  );
}
