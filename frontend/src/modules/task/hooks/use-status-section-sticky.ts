import { type RefObject, useEffect, useRef, useState } from 'react';
import type { VirtualizerHandle } from 'virtua';

interface UseStatusSectionStickyOptions {
  /** Whether observation is enabled */
  enabled: boolean;
  /** Ref to the scrollable viewport (desktop ScrollArea viewport). Null/undefined for window scroll. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Ref to the Virtualizer handle for querying visible item range */
  virtualizerRef: RefObject<VirtualizerHandle | null>;
  /** Index of the first non-accepted task (i.e. accepted tasks are 0..boundaryIndex-1). -1 if none */
  acceptedBoundaryIndex: number;
  /** Index of the first iced task. -1 if none */
  icedBoundaryIndex: number;
  /** Whether the accepted section is currently expanded */
  expandedAccepted: boolean;
  /** Whether the iced section is currently expanded */
  expandedIced: boolean;
}

/**
 * Controls whether accepted/iced section headers should be sticky.
 *
 * Uses the Virtualizer's visible item range to determine whether any
 * accepted or iced tasks are currently in the viewport.
 *
 * Supports both element scroll (desktop ScrollArea) and window scroll (mobile).
 *
 * Sticky activates when:
 * - The user is actively scrolling (auto-hides after 1.5s of inactivity)
 * - The corresponding section is expanded (tasks visible)
 * - Any task in that status group is visible in the viewport
 */
export function useStatusSectionSticky({
  enabled,
  scrollRef,
  virtualizerRef,
  acceptedBoundaryIndex,
  icedBoundaryIndex,
  expandedAccepted,
  expandedIced,
}: UseStatusSectionStickyOptions) {
  const [acceptedVisible, setAcceptedVisible] = useState(false);
  const [icedVisible, setIcedVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!enabled) {
      setAcceptedVisible(false);
      setIcedVisible(false);
      return;
    }

    const virtualizer = virtualizerRef.current;
    if (!virtualizer) return;

    // Determine scroll target: element viewport (desktop) or window (mobile/windowScroll)
    const viewport = scrollRef.current;
    const scrollTarget: HTMLElement | Window = viewport ?? window;

    const check = () => {
      const startIndex = virtualizer.findItemIndex(virtualizer.scrollOffset);
      const endIndex = virtualizer.findItemIndex(virtualizer.scrollOffset + virtualizer.viewportSize);

      // Accepted tasks occupy indices 0..(acceptedBoundaryIndex - 1)
      if (acceptedBoundaryIndex > 0) {
        setAcceptedVisible(startIndex < acceptedBoundaryIndex);
      } else {
        setAcceptedVisible(false);
      }

      // Iced tasks occupy indices icedBoundaryIndex..end
      if (icedBoundaryIndex >= 0) {
        setIcedVisible(endIndex >= icedBoundaryIndex);
      } else {
        setIcedVisible(false);
      }

      // Track scrolling activity
      setIsScrolling(true);
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 1500);
    };

    // Initial check (without activating sticky)
    check();
    setIsScrolling(false);

    // Coalesce scroll bursts into one check per animation frame to avoid a
    // setState-per-scroll-tick re-render storm (expensive with tall cards).
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    };

    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [enabled, scrollRef, virtualizerRef, acceptedBoundaryIndex, icedBoundaryIndex]);

  return {
    stickyAccepted: isScrolling && expandedAccepted && acceptedVisible,
    stickyIced: isScrolling && expandedIced && icedVisible,
  };
}
