import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { ChevronDownIcon, InfoIcon } from 'lucide-react';
import { type FocusEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { VirtualizerHandle } from 'virtua';
import { useBoardStore } from '~/modules/common/board/board-store';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import { type TogglableStatusType, useProjectPanelPrefs, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { hasSectionBar, sectionBarId } from '~/modules/task/helpers/board-helpers';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { triggerSectionGlow } from '~/modules/task/helpers/task-glow';
import { useSectionEdgePinned } from '~/modules/task/hooks/use-section-edge-pinned';
import { boardAcceptedCutOffDays, statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import { olderAcceptedHintFill, statusSectionColors } from '~/modules/task/task-styles';
import type { TaskCounts } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { Collapsible, CollapsibleContent, collapsiblePanelClass } from '~/modules/ui/collapsible';
import { cn } from '~/utils/cn';

interface PanelStatusSectionProps {
  type: TogglableStatusType;
  counts: TaskCounts;
  projectId: string;
  onToggle?: (newState: boolean, type: TogglableStatusType) => void;
  /** Ref to the panel's scrollable viewport, for scroll-direction visibility */
  scrollRef: RefObject<HTMLElement | null>;
  /** Uses window scrolling when true and the viewport element when false. */
  windowMode: boolean;
  virtualizerRef: RefObject<VirtualizerHandle | null>;
  /** Unpins the header: it stays in its place in the list but no longer sticks over the panel's edge. */
  suppressed?: boolean;
}

/** Sticky header of the Accepted or Iced section, with its count and expand toggle; it pins to its edge only while the list scrolls toward it. */
export function PanelStatusSection({
  type,
  counts,
  projectId,
  onToggle,
  scrollRef,
  windowMode,
  virtualizerRef,
  suppressed,
}: PanelStatusSectionProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isActive = hasSectionBar(type, counts);
  const isTop = type === 'accepted';
  // Pinning lives here so scroll flips re-render only this header, not the panel
  const isEdgePinned = useSectionEdgePinned({
    edge: isTop ? 'top' : 'bottom',
    active: isActive && !suppressed,
    scrollRef,
    windowMode,
    listRef: virtualizerRef,
  });
  // A bar with keyboard focus stays pinned, so that focus never rests on a bar slid out of view. A click's focus does not
  // hold it: the bar would stay after the toggle until something else took focus.
  const [hasFocus, setHasFocus] = useState(false);
  const isPinned = !suppressed && (isEdgePinned || hasFocus);

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

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    setHasFocus(event.currentTarget.matches(':focus-visible'));
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
    const style = getComputedStyle(wrapper);
    const navPx =
      (Number.parseFloat(style.getPropertyValue('--sticky-stack-nav')) || 0) + (Number.parseFloat(style.getPropertyValue('--sticky-stack-pin')) || 0);
    host.style.transition = '--sticky-stack-top 300ms ease-in-out';
    host.style.setProperty('--sticky-stack-top', `${navPx + (isPinned && !isTile ? (buttonRef.current?.offsetHeight ?? 0) : 0)}px`);
    return () => {
      host.style.removeProperty('--sticky-stack-top');
      host.style.removeProperty('transition');
    };
  }, [isPinned, isTile, isTop, isActive]);

  if (!isActive) return null;

  return (
    // Unpinned, the inset moves one bar height past the edge: a pinned bar slides out of view, one resting in its own
    // place stays and leaves with the list. Folding its space would shift the list, and the browser's scroll anchoring
    // that follows reads as a scroll to useSectionEdgePinned, which then flips the bars.
    // The wrapper is the surface: bar and note share one fill and one line, so the line rides the note's collapse and a
    // hover shade fading from the bar never meets the note's.
    <div
      ref={wrapperRef}
      className={cn(
        'z-20 shrink-0 transition-[top,bottom,--tw-gradient-from,--tw-gradient-to] duration-300 ease-in-out motion-reduce:transition-none',
        colors.fill,
        colors.text,
        colors.border[isTop ? 'top' : 'bottom'],
        !isTile && colors.hoverFill,
        isTile
          ? 'relative'
          : [
              'sticky',
              // The top bar pins below a page-level sticky nav (mobile tabs); the other to the bottom
              isTop ? (isPinned ? 'top-[calc(var(--sticky-stack-nav)+var(--sticky-stack-pin,0px))]' : '-top-9') : isPinned ? 'bottom-0' : '-bottom-9',
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
        // The press nudges only the text: moved, the button would part from the wrapper's fill and line
        press={false}
        className={cn(
          'group/bar focus-inset flex w-full justify-start rounded-none border-0 bg-transparent px-2 text-sm duration-300 ease-in-out hover:bg-transparent max-sm:px-2.5 dark:hover:bg-transparent',
          // The bar overlaps the wrapper's line, so bar and line together stay the h-9 the list's insets are laid out for
          isTop ? '-mb-px' : '-mt-px',
          colors.hoverText,
        )}
      >
        {/* The count centers over the cards' type buttons and the label starts on their title edge */}
        <span className="group-active/bar:press relative flex w-full items-center gap-0.5">
          <span className="min-w-8 text-center">{count}</span>
          <span className={cn('flex gap-1', hintFadeOut)}>
            <span>{t(`c:${statusOptionsByValue[isTop ? TaskStatus.Accepted : TaskStatus.Iced].name}`).toLowerCase()}</span>
            {!isIced && (
              <>
                <span>{t('c:since')}</span>
                <span>{formatAcceptedCutOff()}</span>
              </>
            )}
            <ChevronDownIcon data-rotate={isExpanded} className="absolute right-2.5 transition-transform data-[rotate=true]:rotate-180" />
          </span>
        </span>
      </Button>
      {hasOnlyOlderAccepted && (
        <Collapsible open={isTile}>
          <CollapsibleContent className={collapsiblePanelClass}>
            {/* The left padding lines the note up with the bar's label: its padding, the count's min-w-8 and the gap */}
            <p className={cn('pt-1 pr-4 pb-4 pl-10.5 text-sm max-sm:pl-11', hintFadeOut)}>
              <OlderAcceptedText i18nKey="c:older_accepted_table_only" count={counts.acceptedCutOff} />
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

const formatAcceptedCutOff = () => dayjs().subtract(boardAcceptedCutOffDays, 'day').format('MMM D');

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
      values={{ date: formatAcceptedCutOff() }}
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
  return (
    <div className={cn('flex gap-4 px-4 py-5 text-xs', olderAcceptedHintFill, statusSectionColors.accepted.text, hintFadeOut)}>
      <InfoIcon className="shrink-0" />
      <p>
        <OlderAcceptedText i18nKey="c:older_accepted_in_table" count={count} />
      </p>
    </div>
  );
}
