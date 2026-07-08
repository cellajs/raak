import { useSearch } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { ChevronDownIcon, InfoIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useBoardStore } from '~/modules/common/board/board-store';
import { defaultPanelPrefs, type TogglableStatusType, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { triggerSectionGlow } from '~/modules/task/helpers/task-glow';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import type { TaskCounts } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { dateMini } from '~/utils/date-mini';

interface PanelStatusSectionProps {
  type: TogglableStatusType;
  counts: TaskCounts;
  projectId: string;
  onToggle?: (newState: boolean, type: TogglableStatusType) => void;
  /** When true, the section becomes sticky (pinned to top/bottom while scrolling) */
  isSticky?: boolean;
  /** Top offset in px when sticky (e.g. to clear a sticky PageTabNav on mobile) */
  stickyTopOffset?: number;
}

/**
 * A section header for "Accepted" or "Iced" tasks within a project panel.
 * Displays the count of tasks in that status, and allows toggling visibility.
 */
export function PanelStatusSection({
  type,
  counts,
  projectId,
  onToggle,
  isSticky = false,
  stickyTopOffset,
}: PanelStatusSectionProps) {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const isMobile = useBreakpointBelow('sm');

  const togglePanelSectionExpandState = useTaskBoardStore((state) => state.togglePanelSectionExpandState);
  const boardId = useBoardStore((state) => state.activeBoardId)!;

  const { q } = useSearch({ strict: false });

  const isIced = type === 'iced';
  const hasOnlyOlderAccepted = !isIced && !counts.accepted && counts.acceptedCutOff > 0;
  const active = isIced ? !!counts.iced : !!counts.accepted || hasOnlyOlderAccepted;
  const count = isIced ? (counts.iced ?? 0) : (counts.accepted ?? 0);

  const showStatus = useTaskBoardStore((state) => {
    const { expandIced, expandAccepted } = state.panelData[boardId]?.[projectId]?.prefs || defaultPanelPrefs;
    return isIced ? expandIced : expandAccepted;
  });

  const showTotal = !q?.trim().length || q?.trim().startsWith('=');

  // Glow the section button when count increases while collapsed
  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (count > prev && !showStatus) {
      triggerSectionGlow(type, projectId);
    }
  }, [count, showStatus, type, projectId]);

  const handleToggleClick = () => {
    onToggle?.(!showStatus, type);
    togglePanelSectionExpandState(boardId, projectId, type);
  };

  if (!active) return null;

  const isIcedSection = type === 'iced';
  const stickyClasses = isSticky ? `sticky z-20 ${isIcedSection ? 'bottom-0' : 'top-0'}` : '';
  const stickyStyle =
    isSticky && !isMobile && !isIcedSection && stickyTopOffset ? { top: `${stickyTopOffset}px` } : undefined;

  return (
    <>
      <Button
        id={`section-${type}-${projectId}`}
        onClick={handleToggleClick}
        variant="ghost"
        size="sm"
        style={stickyStyle}
        className={`relative -mt-[.05rem] flex w-full shrink-0 justify-start gap-1 rounded-none px-1.5 text-xs ring-inset focus-visible:ring-offset-0 sm:px-2 ${stickyClasses}
        ${
          isIcedSection
            ? 'border-b-sky-500/10 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 max-sm:border-b dark:bg-sky-950 dark:text-sky-500 dark:hover:bg-sky-900 dark:hover:text-sky-400'
            : 'border-t border-t-transparent border-b border-b-green-500/10 bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-green-950 dark:text-green-500 dark:hover:bg-green-900 dark:hover:text-green-400'
        }`}
      >
        <div className="flex gap-1.5">
          <span className="min-w-8 text-center">{count}</span>
          <span>{t(`c:${type}`).toLowerCase()}</span>
        </div>
        {!isIced && (
          <div className="flex gap-1">
            <span>{t('c:since')}</span>
            <span>{dateMini(dayjs().subtract(boardAcceptedCutOff, 'day').toISOString(), user?.language || 'en')}</span>
            {counts.accepted !== counts.acceptedCutOff && showTotal && (
              <div className="text-xs">
                <span className="mr-2 ml-1">•</span>
                <span>
                  {(counts.accepted || 0) + counts.acceptedCutOff} {t('c:in_total')}
                </span>
              </div>
            )}
          </div>
        )}
        {active && (
          <ChevronDownIcon
            data-rotate={showStatus}
            size={16}
            className="absolute right-4 transition-transform data-[rotate=true]:rotate-180"
          />
        )}
      </Button>
      {hasOnlyOlderAccepted && showStatus && (
        <div className="flex gap-4 border-b border-b-green-500/10 bg-green-50 px-4 py-5 text-green-500/70 text-xs dark:bg-green-950">
          <InfoIcon size={16} className="inline-block" />
          {t('c:older_accepted_table_only', { count: counts.acceptedCutOff })}
        </div>
      )}
    </>
  );
}
