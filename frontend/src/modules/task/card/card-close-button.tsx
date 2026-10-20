import { XIcon } from 'lucide-react';
import { MotionConfig, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { Button, buttonVariants } from '~/modules/ui/button';

const popIn = { type: 'spring', duration: 0.35, bounce: 0.5 } as const;
const popOut = { duration: 0.15, ease: 'easeIn' } as const;

// Only the icon turns, so a hovered button's backdrop does not spin with it
const pop: Variants = {
  hidden: { scale: 0.5, opacity: 0 },
  shown: { scale: 1, opacity: 1, transition: popIn },
  gone: { scale: 0.5, opacity: 0, transition: popOut },
};
const turn: Variants = {
  hidden: { rotate: -20 },
  shown: { rotate: 0, transition: popIn },
  gone: { rotate: 20, transition: popOut },
};

interface CardCloseButtonProps {
  onClick: () => void;
  /** False mounts it in place, as when a row that is already open scrolls back into view. */
  animateIn?: boolean;
}

/** Collapse button of an open task card or label tile: pops in and out with a slight turn, out as an `AnimatePresence` child. */
export function CardCloseButton({ onClick, animateIn = true }: CardCloseButtonProps) {
  const { t } = useTranslation();

  return (
    <MotionConfig reducedMotion="user">
      <motion.span className="inline-flex" variants={pop} initial={animateIn ? 'hidden' : false} animate="shown" exit="gone">
        <TooltipButton toolTipContent={t('c:close')} side="top" sideOffset={5} hideWhenDetached>
          <Button onClick={onClick} aria-label={t('c:collapse')} variant="ghost" size="xs" className="h-8 w-8">
            <motion.span className="inline-flex" variants={turn}>
              <XIcon />
            </motion.span>
          </Button>
        </TooltipButton>
      </motion.span>
    </MotionConfig>
  );
}

/**
 * The close button popping out where it stood, for a task card whose header unmounts with the collapse. Decorative and
 * gone once it ends; it keeps the button's hover backdrop while the pointer is still on it.
 */
export function CardCloseExit() {
  const [done, setDone] = useState(false);
  if (done) return null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        aria-hidden
        className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'h-8 w-8' })}
        variants={pop}
        initial="shown"
        animate="gone"
        onAnimationComplete={() => setDone(true)}
      >
        <motion.span className="inline-flex" variants={turn}>
          <XIcon />
        </motion.span>
      </motion.span>
    </MotionConfig>
  );
}
