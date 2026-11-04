import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { stroke } = statusIconColors.unstarted;

export function UnstartedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="unstarted" {...props}>
      {/* Started's two squares with their sides opened: every gap spans 6.5 to 9.5, so the openings line up across both */}
      <path
        d="M1.25 6.5V5.5A4.25 4.25 0 0 1 5.5 1.25H6.5M9.5 1.25H10.5A4.25 4.25 0 0 1 14.75 5.5V6.5M14.75 9.5V10.5A4.25 4.25 0 0 1 10.5 14.75H9.5M6.5 14.75H5.5A4.25 4.25 0 0 1 1.25 10.5V9.5M3.75 6.5V6.35A2.6 2.6 0 0 1 6.35 3.75H6.5M9.5 3.75H9.65A2.6 2.6 0 0 1 12.25 6.35V6.5M12.25 9.5V9.65A2.6 2.6 0 0 1 9.65 12.25H9.5M6.5 12.25H6.35A2.6 2.6 0 0 1 3.75 9.65V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={statusIconStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
    </StatusIconFrame>
  );
}
