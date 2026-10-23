import { XIcon } from 'lucide-react';
import { MotionConfig, motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { Button, buttonVariants } from '~/modules/ui/button';

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
}

/** Collapse button of an open task card or label tile: slides and fades in from the right and back out, out as an `AnimatePresence` child. */
export function CardCloseButton({ onClick, animateIn = true }: CardCloseButtonProps) {
  const { t } = useTranslation();

  return (
    <MotionConfig reducedMotion="user">
      <motion.span className="inline-flex" variants={slide} initial={animateIn ? 'hidden' : false} animate="shown" exit="gone">
        <TooltipButton toolTipContent={t('c:close')} side="top" sideOffset={5} hideWhenDetached>
          <Button onClick={onClick} aria-label={t('c:collapse')} variant="ghost" size="xs" className="focus-inset size-8">
            <XIcon />
          </Button>
        </TooltipButton>
      </motion.span>
    </MotionConfig>
  );
}

/**
 * The close button sliding out from where it stood, for a task card whose header unmounts with the collapse. Decorative and
 * gone once it ends; it keeps the button's hover backdrop while the pointer is still on it.
 */
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
