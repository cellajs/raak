import { type RefObject, useEffect, useState } from 'react';

const scrollThreshold = 10; // Minimum accumulated scroll delta counted as a direction signal
const confirmSignals = 2; // Same-direction scroll events required before a flip
const edgeEpsilon = 4; // Distance from a scroll edge where a header sits at its natural position

interface UseSectionEdgeVisibilityOptions {
  /** Which scroll edge the header pins to: accepted pins top, iced pins bottom */
  edge: 'top' | 'bottom';
  /** Ref to the scrollable viewport (desktop ScrollArea viewport) */
  scrollRef: RefObject<HTMLElement | null>;
  /** Uses window scrolling when true and the viewport element when false. */
  windowMode: boolean;
}

/**
 * Shows a sticky status header while scrolling toward its edge and hides it while leaving.
 * Two same-direction events prevent virtualizer corrections from resembling gestures.
 */
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

    // Coalesce scroll bursts into one check per animation frame, counting the
    // events behind each check so a coalesced gesture still confirms a flip
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
