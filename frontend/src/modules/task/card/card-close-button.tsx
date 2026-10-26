import { XIcon } from 'lucide-react';
import { MotionConfig, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { Button, buttonVariants } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

const slideIn = { duration: 0.22, ease: 'easeOut' } as const;
const slideOut = { duration: 0.15, ease: 'easeIn' } as const;

const slide: Variants = {
  hidden: { x: 12, opacity: 0 },
  shown: { x: 0, opacity: 1, transition: slideIn },
  gone: { x: 12, opacity: 0, transition: slideOut },
};

interface CardCloseButtonProps {
  onClick: () => void;
  /** False mounts it in place, as when a row that is already open scrolls back into view. */
  animateIn?: boolean;
  className?: string;
}

/** Collapse button of an open card or tile; slides in from the right and exits as an `AnimatePresence` child. */
export function CardCloseButton({ onClick, animateIn = true, className }: CardCloseButtonProps) {
  const { t } = useTranslation();

  return (
    <MotionConfig reducedMotion="user">
      <motion.span className="inline-flex" variants={slide} initial={animateIn ? 'hidden' : false} animate="shown" exit="gone">
        <TooltipButton toolTipContent={t('c:close')} side="top" sideOffset={5} hideWhenDetached>
          <Button onClick={onClick} aria-label={t('c:collapse')} variant="ghost" size="xs" className={cn('size-8', className)}>
            <XIcon />
          </Button>
        </TooltipButton>
      </motion.span>
    </MotionConfig>
  );
}

/** Decorative copy of the close button that slides out after a collapse unmounts the header; it keeps the hover backdrop. */
export function CardCloseExit() {
  const [done, setDone] = useState(false);
  if (done) return null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        aria-hidden
        className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'size-8' })}
        variants={slide}
        initial="shown"
        animate="gone"
        onAnimationComplete={() => setDone(true)}
      >
        <XIcon />
      </motion.span>
    </MotionConfig>
  );
}
