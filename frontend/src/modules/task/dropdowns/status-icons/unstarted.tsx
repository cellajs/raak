import type { SVGProps } from 'react';
import { StatusIconFrame, statusIconStrokeWidth } from '~/modules/task/dropdowns/status-icons/status-icon-frame';
import { statusIconColors } from '~/modules/task/task-styles';

const { stroke } = statusIconColors.unstarted;

const radius = 6.25;
const period = (2 * Math.PI * radius) / 4;
const gap = 3 + statusIconStrokeWidth; // round caps eat a stroke width of each gap
const dash = period - gap;
// A dash centered on top puts the four gaps on the diagonals
const rotation = -90 - (dash / 2 / radius) * (180 / Math.PI);

export function UnstartedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <StatusIconFrame statusName="unstarted" {...props}>
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={statusIconStrokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        transform={`rotate(${rotation} 8 8)`}
        className={stroke}
      />
    </StatusIconFrame>
  );
}
