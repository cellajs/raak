import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { fill, stroke } = statusIconColors.finished;

export function FinishedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="delivered" {...props}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="#ca8a04" strokeWidth={statusIconStrokeWidth} className={stroke} />
      <path d="M8 8V4.1A3.9 3.9 0 0 1 8 11.9Z" fill="#ca8a04" className={fill} />
    </StatusIconFrame>
  );
}
