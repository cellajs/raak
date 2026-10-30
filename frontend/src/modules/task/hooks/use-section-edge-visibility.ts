import { type RefObject, useEffect, useState } from 'react';

const scrollThreshold = 10; // Minimum accumulated scroll delta counted as a direction signal
const confirmSignals = 2; // Same-direction scroll events before a flip, so a virtualizer correction does not read as a gesture

interface UseSectionEdgeVisibilityOptions {
  /** Accepted pins to the top, iced to the bottom. */
  edge: 'top' | 'bottom';
  /** The sticky element itself, next to the list in the flow. */
  barRef: RefObject<HTMLElement | null>;
  /** False while the bar is not rendered. */
  active: boolean;
  scrollRef: RefObject<HTMLElement | null>;
  /** Scrolls the window when true, else the `scrollRef` viewport. */
  windowMode: boolean;
}

/** Keeps a sticky status header shown while its own slot is on screen; pinned, it shows while scrolling toward its edge and hides while leaving. */
export function useSectionEdgeVisibility({ edge, barRef, active, scrollRef, windowMode }: UseSectionEdgeVisibilityOptions) {
  const [visible, setVisible] = useState(edge === 'top');

  useEffect(() => {
    const bar = barRef.current;
    if (!active || !bar) return;

    const viewport = windowMode ? null : scrollRef.current;
    const target: HTMLElement | Window = viewport ?? window;

    const scrollY = () => (viewport ? viewport.scrollTop : window.scrollY);

    // Hiding the bar leaves its slot empty, so it may only hide once the slot has scrolled away. A sticky element
    // reports where it is pinned, not where its slot is: the neighbor in the flow marks the slot's far side.
    const slotShows = () => {
      const { top, bottom } = bar.getBoundingClientRect();
      const neighbor = (edge === 'top' ? bar.nextElementSibling : bar.previousElementSibling)?.getBoundingClientRect();
      if (!neighbor) return true;
      return edge === 'top' ? neighbor.top - top > 1 : bottom - neighbor.bottom > 1;
    };

    setVisible(slotShows());

    let lastY = scrollY();
    let dir = 0;
    let dirSignals = 0;
    let pendingEvents = 0;

    const check = () => {
      const y = scrollY();
      const events = pendingEvents;
      pendingEvents = 0;
      const inSlot = slotShows();
      if (inSlot) setVisible(true);

      const delta = y - lastY;
      // Sub-threshold moves keep the stale baseline so small deltas accumulate
      if (Math.abs(delta) <= scrollThreshold) return;
      lastY = y;

      const newDir = delta < 0 ? -1 : 1;
      dirSignals = newDir === dir ? dirSignals + events : events;
      dir = newDir;
      if (dirSignals < confirmSignals) return;

      const towardsEdge = edge === 'top' ? dir === -1 : dir === 1;
      setVisible(towardsEdge || inSlot);
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

    // A shrinking list brings the iced slot on screen without any scroll event
    const listObserver = new ResizeObserver(() => {
      if (slotShows()) setVisible(true);
    });
    if (edge === 'bottom' && bar.previousElementSibling) listObserver.observe(bar.previousElementSibling);

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', handleScroll);
      listObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [edge, barRef, active, scrollRef, windowMode]);

  return visible;
}
