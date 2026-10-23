import { type RefObject, useEffect, useState } from 'react';

const scrollThreshold = 10; // Minimum accumulated scroll delta counted as a direction signal
const confirmSignals = 2; // Same-direction scroll events before a flip, so a virtualizer correction does not read as a gesture
const edgeEpsilon = 4; // Distance from a scroll edge where a header sits at its natural position

interface UseSectionEdgeVisibilityOptions {
  /** Accepted pins to the top, iced to the bottom. */
  edge: 'top' | 'bottom';
  scrollRef: RefObject<HTMLElement | null>;
  /** Scrolls the window when true, else the `scrollRef` viewport. */
  windowMode: boolean;
}

/** Shows a sticky status header while scrolling toward its edge and hides it while leaving. */
export function useSectionEdgeVisibility({ edge, scrollRef, windowMode }: UseSectionEdgeVisibilityOptions) {
  const [visible, setVisible] = useState(edge === 'top');

  useEffect(() => {
    const viewport = windowMode ? null : scrollRef.current;
    const target: HTMLElement | Window = viewport ?? window;

    const metrics = () =>
      viewport
        ? { y: viewport.scrollTop, max: viewport.scrollHeight - viewport.clientHeight }
        : { y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight };

    const atEdge = (y: number, max: number) => (edge === 'top' ? y <= edgeEpsilon : y >= max - edgeEpsilon);

    const initial = metrics();
    setVisible(atEdge(initial.y, initial.max));

    let lastY = initial.y;
    let dir = 0;
    let dirSignals = 0;
    let pendingEvents = 0;

    const check = () => {
      const { y, max } = metrics();
      const events = pendingEvents;
      pendingEvents = 0;
      if (atEdge(y, max)) setVisible(true);

      const delta = y - lastY;
      // Sub-threshold moves keep the stale baseline so small deltas accumulate
      if (Math.abs(delta) <= scrollThreshold) return;
      lastY = y;

      const newDir = delta < 0 ? -1 : 1;
      dirSignals = newDir === dir ? dirSignals + events : events;
      dir = newDir;
      if (dirSignals < confirmSignals) return;

      const towardsEdge = edge === 'top' ? dir === -1 : dir === 1;
      if (towardsEdge) setVisible(true);
      else setVisible(atEdge(y, max));
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
  }, [edge, scrollRef, windowMode]);

  return visible;
}
