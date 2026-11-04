import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { fill, stroke } = statusIconColors.accepted;

export function AcceptedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="done" {...props}>
      {/* Ends Started's quarter and Delivered's half. No tick: beside the card's checkbox, a ticked box reads as checked. */}
      <rect
        x="1.25"
        y="1.25"
        width="13.5"
        height="13.5"
        rx="4.25"
        fill="none"
        stroke="#16a34a"
        strokeWidth={statusIconStrokeWidth}
        className={stroke}
      />
      <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="3.15" fill="#16a34a" className={fill} />
    </StatusIconFrame>
  );
}
