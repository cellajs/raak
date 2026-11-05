import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { stroke } = statusIconColors.iced;

export function IcedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="iced" {...props}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="#0284c7" strokeWidth={statusIconStrokeWidth} className={stroke} />
      <path
        d="M8 4.3V11.7M4.8 6.15 11.2 9.85M4.8 9.85 11.2 6.15"
        fill="none"
        stroke="#0284c7"
        strokeWidth={statusIconStrokeWidth}
        strokeLinecap="round"
        className={stroke}
      />
    </StatusIconFrame>
  );
}
