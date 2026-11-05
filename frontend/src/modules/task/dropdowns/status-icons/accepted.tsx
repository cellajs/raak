import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { fill, stroke } = statusIconColors.accepted;

export function AcceptedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="accepted" {...props}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="#16a34a" strokeWidth={statusIconStrokeWidth} className={stroke} />
      <circle cx="8" cy="8" r="3.9" fill="#16a34a" className={fill} />
    </StatusIconFrame>
  );
}
