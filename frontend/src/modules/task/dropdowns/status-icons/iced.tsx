import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { fill, stroke } = statusIconColors.iced;

export function IcedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="iced" {...props}>
      <rect
        x="1.25"
        y="1.25"
        width="13.5"
        height="13.5"
        rx="4.25"
        fill="none"
        stroke="#0284c7"
        strokeWidth={statusIconStrokeWidth}
        className={stroke}
      />
      <path fillRule="evenodd" clipRule="evenodd" fill="#0284c7" d="M12.7 13.8 2.5 3.6l.8-.8L13.5 13l-.8.8Z" className={fill} />
      <path fill="#0284c7" d="M2.5 13.2 12.7 3l.8.8L3.3 14l-.8-.8Z" className={fill} />
      <path
        stroke="#0284c7"
        strokeWidth={statusIconStrokeWidth}
        d="M9.6 6.8H14M9.6 1.8v4.8M6.5 6.8H1.3M6.8 1.8V7M6.9 9.7H2.1M6.8 14.2V9.8M9.6 9.8h5"
        className={stroke}
      />
      <path stroke="#0284c7" strokeWidth={statusIconStrokeWidth} d="M0-.6h4.4" transform="matrix(0 -1 -1 0 9 14.2)" className={stroke} />
    </StatusIconFrame>
  );
}
