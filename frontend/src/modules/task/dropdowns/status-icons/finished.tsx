import type { SVGProps } from 'react';
import { STATUS_ICON_STROKE_WIDTH } from '~/modules/task/dropdowns/status-icons/constants';

export const FinishedIcon = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label="Finished" {...props}>
    <title>Finished</title>
    <path d="M8 3.2H9.65a3.15 3.15 0 0 1 3.15 3.15V9.65a3.15 3.15 0 0 1-3.15 3.15H8Z" fill="#97C022" />
    <rect
      x="3.75"
      y="3.75"
      width="8.5"
      height="8.5"
      rx="2.6"
      fill="none"
      stroke="#97C022"
      strokeWidth={STATUS_ICON_STROKE_WIDTH}
    />
    <rect
      x="1.25"
      y="1.25"
      width="13.5"
      height="13.5"
      rx="4.25"
      fill="none"
      stroke="#97C022"
      strokeWidth={STATUS_ICON_STROKE_WIDTH}
    />
  </svg>
);
