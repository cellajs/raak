import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { ChevronDownIcon, InfoIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useBoardStore } from '~/modules/common/board/board-store';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import { type TogglableStatusType, useProjectPanelPrefs, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { hasSectionBar, sectionBarId } from '~/modules/task/helpers/board-helpers';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { triggerSectionGlow } from '~/modules/task/helpers/task-glow';
import { useSectionEdgeVisibility } from '~/modules/task/hooks/use-section-edge-visibility';
import { boardAcceptedCutOffDays } from '~/modules/task/task-properties';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { Collapsible, CollapsibleContent, collapsiblePanelClass } from '~/modules/ui/collapsible';
import { cn } from '~/utils/cn';
import { dateMini } from '~/utils/date-mini';

interface PanelStatusSectionProps {
  type: TogglableStatusType;
  counts: TaskCounts;
  projectId: string;
  onToggle?: (newState: boolean, type: TogglableStatusType) => void;
  /** Ref to the panel's scrollable viewport, for scroll-direction visibility */
  scrollRef: RefObject<HTMLElement | null>;
  /** Uses window scrolling when true and the viewport element when false. */
  windowMode: boolean;
  /** Unpins the header: it stays in its place in the list but no longer sticks over the panel's edge. */
  suppressed?: boolean;
}

/** Sticky header of the Accepted or Iced section, with its count and expand toggle; once pinned it hides on scroll like the floating nav buttons. */
export function PanelStatusSection({ type, counts, projectId, onToggle, scrollRef, windowMode, suppressed }: PanelStatusSectionProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isActive = hasSectionBar(type, counts);
  const isTop = type === 'accepted';
  // Visibility lives here so scroll flips re-render only this header, not the panel
  const isEdgeVisible = useSectionEdgeVisibility({
    edge: isTop ? 'top' : 'bottom',
    barRef: wrapperRef,
    active: isActive,
    scrollRef,
    windowMode,
  });
  // A focused bar stays visible: keyboard focus never rests on a bar slid out of view
  const [hasFocus, setHasFocus] = useState(false);
  const isVisible = isEdgeVisible || hasFocus;

  const setPanelSectionExpanded = useTaskBoardStore((state) => state.setPanelSectionExpanded);
  const boardId = useBoardStore((state) => state.activeBoardId)!;

  const isIced = type === 'iced';
  const hasOnlyOlderAccepted = !isIced && !counts.accepted && counts.acceptedCutOff > 0;
  const barId = sectionBarId(type, projectId);
  const count = isIced ? counts.iced : counts.accepted;
  const colors = statusSectionColors[type];

  const { expandIced, expandAccepted } = useProjectPanelPrefs(projectId);
  const isExpanded = isIced ? expandIced : expandAccepted;
  // Open with no cards under it, the bar and its note read as one tile; a pinned bar would part from the note
  const isTile = hasOnlyOlderAccepted && isExpanded;

  // Glow the section button when count increases while collapsed
  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (count > prev && !isExpanded) triggerSectionGlow(type, projectId);
  }, [count, isExpanded, type, projectId]);

  const handleToggleClick = () => {
    onToggle?.(!isExpanded, type);
    setPanelSectionExpanded(boardId, projectId, type, !isExpanded);
  };

  const handleFocus = () => {
    setHasFocus(true);
    setCurrentItem(barId);
  };

  // Publishes the top bar's pinned height as --sticky-stack-top on the panel content, so card headers (StickyBox)
  // pin below the bar and glide with its transition. Set imperatively to avoid re-rendering the panel's cards.
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isTop) return;
    const wrapper = wrapperRef.current;
    const host = wrapper?.parentElement;
    if (!host) return;
    // Fold in the page-level nav offset (mobile tabs) so consumers stack below both bars
    const navPx = Number.parseFloat(getComputedStyle(wrapper).getPropertyValue('--sticky-stack-nav')) || 0;
    host.style.transition = '--sticky-stack-top 300ms ease-in-out';
    host.style.setProperty('--sticky-stack-top', `${navPx + (isVisible && !suppressed && !isTile ? (buttonRef.current?.offsetHeight ?? 0) : 0)}px`);
    return () => {
      host.style.removeProperty('--sticky-stack-top');
      host.style.removeProperty('transition');
    };
  }, [isVisible, suppressed, isTile, isTop, isActive]);

  if (!isActive) return null;

  return (
    // The wrapper stays sticky and clips the sliding button: overflow-clip does not create a
    // scroll container (sticky keeps working) and stops the translated button from extending
    // the panel's scrollable overflow, which would churn scrollHeight during the animation.
    // Suppressed, the inset moves one bar height past the edge: a pinned bar slides out of view, one resting in its
    // own place stays. Folding its space would shift the list, and the browser's scroll anchoring that follows
    // reads as a scroll to useSectionEdgeVisibility, which then flips the bars.
    <div
      ref={wrapperRef}
      className={cn(
        'pointer-events-none z-20 shrink-0 overflow-clip transition-[top,bottom] duration-300 ease-in-out motion-reduce:transition-none',
        isTile
          ? 'relative'
          : [
              'sticky',
              // The top bar pins below a page-level sticky nav (mobile tabs); the other to the bottom
              isTop ? (suppressed ? '-top-9' : 'top-(--sticky-stack-nav)') : suppressed ? '-bottom-9' : 'bottom-0',
              isTop ? 'text-editing:-top-9' : 'text-editing:-bottom-9',
            ],
      )}
    >
      <Button
        ref={buttonRef}
        id={barId}
        // A row of the panel list, reached with ↑/↓, so not a Tab stop of its own
        tabIndex={-1}
        onClick={handleToggleClick}
        onFocus={handleFocus}
        onBlur={() => setHasFocus(false)}
        variant="ghost"
        size="sm"
        className={cn(
          'focus-inset relative flex w-full justify-start gap-1 rounded-none border-0 bg-clip-border px-2 text-sm transition-[translate,opacity,color,background-color,border-color,box-shadow,--tw-gradient-from,--tw-gradient-to] duration-300 ease-in-out hover:bg-background dark:hover:bg-background',
          isVisible ? 'pointer-events-auto' : isTop ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0',
          colors.fill,
          colors.text,
          isIced
            ? 'hover:from-sky-500/26 hover:to-sky-500/36 hover:text-sky-900 dark:hover:from-sky-500/22 dark:hover:to-sky-500/32 dark:hover:text-sky-200'
            : cn(
                'hover:text-green-900 dark:hover:text-green-200',
                !isTile && 'hover:from-green-500/26 hover:to-green-500/36 dark:hover:from-green-500/22 dark:hover:to-green-500/32',
              ),
          colors.border[isTop ? 'top' : 'bottom'],
          isTile && 'border-b-0',
        )}
      >
        <span className="min-w-8 text-center">{count}</span>
        <span className={cn('ml-1.5 flex gap-1', hintFadeOut)}>
          <span>{t(`c:${type}`).toLowerCase()}</span>
          {!isIced && (
            <>
              <span>{t('c:since')}</span>
              <span>{dateMini(dayjs().subtract(boardAcceptedCutOffDays, 'day').toISOString())}</span>
            </>
          )}
          <ChevronDownIcon data-rotate={isExpanded} className="absolute right-4.5 transition-transform data-[rotate=true]:rotate-180" />
        </span>
      </Button>
      {hasOnlyOlderAccepted && (
        <Collapsible open={isTile}>
          <CollapsibleContent className={collapsiblePanelClass}>
            {/* The left padding lines the note up with the bar's label: its padding, the count's min-w-8, the gap and ml-1.5 */}
            <p
              className={cn(
                'pointer-events-auto pt-1 pr-4 pb-4 pl-12.5 text-sm',
                statusSectionColors.accepted.tileBody,
                colors.text,
                colors.border.top,
                hintFadeOut,
              )}
            >
              <OlderAcceptedText i18nKey="c:older_accepted_table_only" count={counts.acceptedCutOff} />
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

interface OlderAcceptedTextProps {
  i18nKey: 'c:older_accepted_table_only' | 'c:older_accepted_in_table';
  count: number;
}

function OlderAcceptedText({ i18nKey, count }: OlderAcceptedTextProps) {
  const { t } = useTranslation();

  return (
    <Trans
      t={t}
      i18nKey={i18nKey}
      count={count}
      components={{
        table_anchor: <Link to="." resetScroll={false} search={(prev) => ({ ...prev, view: 'table' })} className="link-inline" />,
      }}
    />
  );
}

interface OlderAcceptedHintProps {
  count: number;
}

/** Points to the table for the accepted tasks the board leaves out, in a panel with no accepted bar to carry them. */
export function OlderAcceptedHint({ count }: OlderAcceptedHintProps) {
  const colors = statusSectionColors.accepted;

  return (
    <div className={cn('flex gap-4 bg-green-50 px-4 py-5 text-xs dark:bg-green-950', colors.border.top, colors.text, hintFadeOut)}>
      <InfoIcon className="shrink-0" />
      <p>
        <OlderAcceptedText i18nKey="c:older_accepted_in_table" count={count} />
      </p>
    </div>
  );
}
