import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { fill, stroke } = statusIconColors.reviewed;

export function ReviewedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="reviewed" {...props}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="#ea580c" strokeWidth={statusIconStrokeWidth} className={stroke} />
      <path d="M8 8V4.1A3.9 3.9 0 1 1 4.1 8Z" fill="#ea580c" className={fill} />
    </StatusIconFrame>
  );
}
