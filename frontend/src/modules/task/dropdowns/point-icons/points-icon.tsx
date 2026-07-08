import type { SVGProps } from 'react';
import type { TaskPointsType } from '~/modules/task/types';

/** The three ascending bars, shared by every points level. */
const BARS = [
  { x: 1.5, y: 8, height: 6 },
  { x: 6.5, y: 5, height: 9 },
  { x: 11.5, y: 2, height: 12 },
] as const;

const LABELS = ['None', 'Low', 'Medium', 'High'] as const;

/**
 * Story-points bars (0-3): the first `level` bars are solid, the rest faded.
 * Replaces the former one-file-per-level icons (none/low/medium/high).
 * Inherits color from `currentColor`; consumers set `fill-current` / `fill-primary`.
 */
export const PointsIcon = ({ level, ...props }: SVGProps<SVGSVGElement> & { level: NonNullable<TaskPointsType> }) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-label={LABELS[level]}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>{LABELS[level]}</title>
    {BARS.map((bar, i) => (
      <rect key={bar.x} width="3" height={bar.height} x={bar.x} y={bar.y} rx="1" fillOpacity={i < level ? 1 : 0.4} />
    ))}
  </svg>
);
