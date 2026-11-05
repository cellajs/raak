import { CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { announce } from '~/modules/common/announce';
import { toaster } from '~/modules/common/toaster/toaster';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { checkDuration } from '~/modules/task/card/task-start-check';
import { productRef } from '~/modules/task/helpers/product-ref';
import { Badge } from '~/modules/ui/badge';
import { cn } from '~/utils/cn';
import '~/modules/task/product-ref.css';

interface ProductRefButtonProps {
  number: number;
  /** Resolves to whether the copy worked. */
  onCopy: () => Promise<boolean>;
  tabIndex?: number;
  className?: string;
}

/** `#123` in a badge that copies content on click and draws a check over its # once it has (product-ref.css). */
export function ProductRefButton({ number, onCopy, tabIndex, className }: ProductRefButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!productRef(number)) return null;

  const handleClick = async (target: HTMLElement) => {
    if (!(await onCopy())) return toaster.error(t('c:copy_failed'));
    setCopied(true);
    announce(target, t('c:copied'));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), checkDuration);
  };

  return (
    <TooltipButton toolTipContent={copied ? t('c:copied') : t('c:copy_content')} side="top" sideOffset={5} hideWhenDetached>
      <Badge
        render={<button type="button" />}
        variant="secondary"
        tabIndex={tabIndex}
        onClick={({ currentTarget }) => handleClick(currentTarget)}
        aria-label={`${t('c:copy_content')}: ${productRef(number)}`}
        data-product-ref
        data-copied={copied || undefined}
        className={cn(
          'cursor-pointer gap-0 pl-1.5 font-normal text-muted-foreground tabular-nums transition-[color,background-color,box-shadow] duration-150 hover:bg-muted-hover hover:text-foreground',
          className,
        )}
      >
        <span data-ref-slot aria-hidden="true">
          <span data-ref-hash>#</span>
          <CopyIcon data-ref-copy strokeWidth={2.5} />
          <svg
            data-ref-check
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path pathLength={1} d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
        {number}
      </Badge>
    </TooltipButton>
  );
}
