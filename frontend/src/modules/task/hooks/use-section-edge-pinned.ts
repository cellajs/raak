import { type RefObject, useEffect, useState } from 'react';
import type { VirtualizerHandle } from 'virtua';

const scrollThreshold = 10; // Minimum accumulated scroll delta counted as a direction signal
const confirmSignals = 2; // Same-direction scroll events before a flip, so a single jump (a reveal, a clamp) does not read as a gesture

type ListHandle = Pick<VirtualizerHandle, 'scrollOffset' | 'findItemIndex' | 'getItemOffset'>;

interface UseSectionEdgePinnedOptions {
  /** The end of the list the bar sits at and pins to. */
  edge: 'top' | 'bottom';
  /** False while the bar is not rendered or may not pin; it then starts unpinned when it turns true. */
  active: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  /** Scrolls the window when true, else the `scrollRef` viewport. */
  windowMode: boolean;
  /** The list's virtualizer, list or window: scroll movement is read against its rows. */
  listRef: RefObject<ListHandle | null>;
}

/**
 * Whether a sticky status header pins to its edge: only while the list scrolls toward that edge. Otherwise it rests in
 * its slot and leaves with it, so a scroll away never pins the bar just to slide it out again.
 */
export function useSectionEdgePinned({ edge, active, scrollRef, windowMode, listRef }: UseSectionEdgePinnedOptions) {
  // Compiler gap: pendingEvents++ on a variable the scroll handler captures.
  'use no memo';
  const [pinned, setPinned] = useState(false);
  // A direction read before the pause would pin the bar the moment it ends, with no scroll to ask for it
  if (!active && pinned) setPinned(false);

  useEffect(() => {
    if (!active) return;

    const viewport = windowMode ? null : scrollRef.current;
    const target: HTMLElement | Window = viewport ?? window;

    // Measured from a row, not the scroll offset: as rows above come into view and are measured, virtua moves the offset
    // by their correction to hold the view still. Read off the offset alone, each correction reverses an upward scroll.
    let anchor = 0;
    let lastY = 0;
    let lastRow = 0;
    const position = () => {
      const list = listRef.current;
      if (!list) return viewport ? viewport.scrollTop : window.scrollY;
      return list.scrollOffset - list.getItemOffset(anchor);
    };
    const rowsChanged = () => (listRef.current?.findItemIndex(Number.POSITIVE_INFINITY) ?? 0) !== lastRow;
    const rebase = () => {
      const list = listRef.current;
      if (list) {
        anchor = list.findItemIndex(list.scrollOffset);
        lastRow = list.findItemIndex(Number.POSITIVE_INFINITY);
      }
      lastY = position();
    };

    rebase();
    let dir = 0;
    let dirSignals = 0;
    let pendingEvents = 0;

    const check = () => {
      const events = pendingEvents;
      pendingEvents = 0;

      // Rows added or removed, a fold among them, move the anchor row by their size: no direction to read
      if (rowsChanged()) return rebase();

      const delta = position() - lastY;
      // Sub-threshold moves keep the stale baseline so small deltas accumulate
      if (Math.abs(delta) <= scrollThreshold) return;
      rebase();

      const newDir = delta < 0 ? -1 : 1;
      dirSignals = newDir === dir ? dirSignals + events : events;
      dir = newDir;
      if (dirSignals < confirmSignals) return;

      setPinned(edge === 'top' ? dir === -1 : dir === 1);
    };

    // One check per frame; counting the events behind it lets a coalesced gesture still confirm a flip
    let raf = 0;
    const handleScroll = () => {
      pendingEvents++;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(raf);
    };
  }, [edge, active, scrollRef, windowMode, listRef]);

  return pinned;
}
