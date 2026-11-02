import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '~/utils/cn';

export interface DemoCursorState {
  x: number;
  y: number;
  name: string;
  pressed: boolean;
  visible: boolean;
}

interface DemoCursorProps {
  cursor: DemoCursorState;
  /** Keeps the name inside the frame when the cursor is near its right edge. */
  nameOnLeft: boolean;
  /** What the cursor carries, such as a dragged card. */
  children?: ReactNode;
}

/** A teammate's cursor over the demo board. */
export function DemoCursor({ cursor, nameOnLeft, children }: DemoCursorProps) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-100"
      initial={false}
      animate={{ x: cursor.x, y: cursor.y, opacity: cursor.visible ? 1 : 0, scale: cursor.pressed ? 0.88 : 1 }}
      transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.8 }}
    >
      {children}
      <svg viewBox="0 0 24 24" aria-hidden="true" className="relative size-5 fill-foreground stroke-background drop-shadow-md" strokeWidth={1.5}>
        <path d="M4 3l7.5 18 2.6-7.4L21.5 11z" />
      </svg>
      <span
        className={cn('absolute top-5 rounded-full bg-foreground px-2 py-0.5 font-medium text-background text-xs', nameOnLeft ? 'right-4' : 'left-4')}
      >
        {cursor.name}
      </span>
    </motion.div>
  );
}
