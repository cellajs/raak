import type { SVGProps } from 'react';
import { STATUS_ICON_STROKE_WIDTH } from '~/modules/task/dropdowns/status-icons/constants';

/** Renders the unstarted icon. */
export function UnstartedIcon({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Backlog"
      {...props}
    >
      <title>Backlog</title>
      <rect
        x="1.25"
        y="1.25"
        width="13.5"
        height="13.5"
        rx="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth={STATUS_ICON_STROKE_WIDTH}
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
        strokeWidth={STATUS_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray="0.01 1.8"
      />
    </svg>
  );
}
