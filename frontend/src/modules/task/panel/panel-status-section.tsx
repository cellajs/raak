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
import { isBoardSearchActive } from '~/modules/task/helpers/search-filter';
import { triggerSectionGlow } from '~/modules/task/helpers/task-glow';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useSectionEdgeVisibility } from '~/modules/task/hooks/use-section-edge-visibility';
import { boardAcceptedCutOffDays } from '~/modules/task/task-properties';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
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

  const search = useBoardSearch();

  const isIced = type === 'iced';
  const hasOnlyOlderAccepted = !isIced && !counts.accepted && counts.acceptedCutOff > 0;
  const barId = sectionBarId(type, projectId);
  const count = isIced ? counts.iced : counts.accepted;
  const colors = statusSectionColors[type];

  const { expandIced, expandAccepted } = useProjectPanelPrefs(projectId);
  const isExpanded = isIced ? expandIced : expandAccepted;

  const showTotal = !isBoardSearchActive(search);

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
    host.style.setProperty('--sticky-stack-top', `${navPx + (isVisible && !suppressed ? (buttonRef.current?.offsetHeight ?? 0) : 0)}px`);
    return () => {
      host.style.removeProperty('--sticky-stack-top');
      host.style.removeProperty('transition');
    };
  }, [isVisible, suppressed, isTop, isActive]);

  if (!isActive) return null;

  return (
    <>
      {/* The wrapper stays sticky and clips the sliding button: overflow-clip does not create a
          scroll container (sticky keeps working) and stops the translated button from extending
          the panel's scrollable overflow, which would churn scrollHeight during the animation.
          Suppressed, the inset moves one bar height past the edge: a pinned bar slides out of view, one resting in its
          own place stays. Folding its space would shift the list, and the browser's scroll anchoring that follows
          reads as a scroll to useSectionEdgeVisibility, which then flips the bars. */}
      <div
        ref={wrapperRef}
        className={cn(
          'pointer-events-none sticky z-20 shrink-0 overflow-clip transition-[top,bottom] duration-300 ease-in-out motion-reduce:transition-none',
          // The top bar pins below a page-level sticky nav (mobile tabs); the other to the bottom
          isTop ? (suppressed ? '-top-9' : 'top-(--sticky-stack-nav)') : suppressed ? '-bottom-9' : 'bottom-0',
          isTop ? 'text-editing:-top-9' : 'text-editing:-bottom-9',
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
            'focus-inset relative flex w-full justify-start gap-1 rounded-none border-0 bg-clip-border px-1.5 text-xs transition-[translate,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out sm:px-2',
            isVisible ? 'pointer-events-auto' : isTop ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0',
            colors.fill,
            colors.text,
            isIced
              ? 'hover:bg-sky-100 hover:text-sky-800 max-sm:border-b-sky-500/10 dark:hover:bg-sky-900 dark:hover:text-sky-300'
              : 'hover:bg-green-100 hover:text-green-800 dark:hover:bg-green-900 dark:hover:text-green-400',
            isTop && colors.border.top,
          )}
        >
          <span className="min-w-8 text-center">{count}</span>
          <span className={cn('ml-0.5 flex gap-1', hintFadeOut)}>
            <span>{t(`c:${type}`).toLowerCase()}</span>
            {!isIced && (
              <>
                <span>{t('c:since')}</span>
                <span>{dateMini(dayjs().subtract(boardAcceptedCutOffDays, 'day').toISOString())}</span>
                {counts.accepted !== counts.acceptedCutOff && showTotal && (
                  <div>
                    <span className="mr-2 ml-1">•</span>
                    <span>
                      {counts.accepted + counts.acceptedCutOff} {t('c:in_total')}
                    </span>
                  </div>
                )}
              </>
            )}
            <ChevronDownIcon data-rotate={isExpanded} className="absolute right-4 transition-transform data-[rotate=true]:rotate-180" />
          </span>
        </Button>
      </div>
      {hasOnlyOlderAccepted && isExpanded && <OlderAcceptedHint i18nKey="c:older_accepted_table_only" count={counts.acceptedCutOff} />}
    </>
  );
}

interface OlderAcceptedHintProps {
  i18nKey: 'c:older_accepted_table_only' | 'c:older_accepted_in_table';
  count: number;
}

/** Points to the table for the accepted tasks the board leaves out. */
export function OlderAcceptedHint({ i18nKey, count }: OlderAcceptedHintProps) {
  const { t } = useTranslation();
  const colors = statusSectionColors.accepted;

  return (
    <div className={cn('flex gap-4 px-4 py-5 text-xs', colors.border.top, colors.fill, colors.text, hintFadeOut)}>
      <InfoIcon className="shrink-0" />
      <p>
        <Trans
          t={t}
          i18nKey={i18nKey}
          count={count}
          components={{
            table_anchor: <Link to="." resetScroll={false} search={(prev) => ({ ...prev, view: 'table' })} className="link-inline" />,
          }}
        />
      </p>
    </div>
  );
}
