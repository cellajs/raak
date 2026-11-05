import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/modules/ui/tooltip';
import { cn } from '~/utils/cn';

interface CardTooltipProps {
  content: string;
  className?: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}

/** A tooltip on a wrapper around a card control, which keeps its id for the hotkeys: an id on a tooltip trigger makes the tooltip flash shut. */
export function CardTooltip({ content, className, side = 'top', children }: CardTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn('flex', className)} />}>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={5}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
