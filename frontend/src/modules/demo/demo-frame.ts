import { useEffect } from 'react';
import { type DemoFrameMessageBody, demoFrameMessage, isDemoFrameMessage } from '~/modules/demo/demo-account';
import '~/modules/demo/demo-view.css';

const lineHeight = 16;

const post = (message: DemoFrameMessageBody) => window.parent.postMessage({ type: demoFrameMessage, ...message }, window.location.origin);

/**
 * A demo shows the board alone, in the about page's frame and in a full window alike: focus view on the root
 * element, since the page's focus view container owns the body's class and the stored setting is shared with every tab.
 */
export function useDemoView(shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    document.documentElement.classList.add('focus-view', 'demo-view');
    return () => document.documentElement.classList.remove('focus-view', 'demo-view');
  }, [shown]);
}

/**
 * The app inside the about page's frame hands the wheel to the page until the visitor presses inside, so a page
 * scrolled past the board keeps scrolling, and tells the page once its layout has mounted.
 */
export function useDemoFrame(framed: boolean) {
  useEffect(() => {
    if (!framed) return;
    let engaged = false;

    const engage = () => {
      if (engaged) return;
      engaged = true;
      post({ kind: 'engaged' });
    };
    const handOver = (event: WheelEvent) => {
      // Pinch and ctrl-wheel zoom the browser, which a frame cannot pass on
      if (engaged || event.ctrlKey) return;
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      post({ kind: 'wheel', deltaX: event.deltaX * unit, deltaY: event.deltaY * unit });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (!isDemoFrameMessage(event.data)) return;
      if (event.data.kind === 'release') engaged = false;
      if (event.data.kind === 'hold') engaged = true;
    };

    window.addEventListener('wheel', handOver, { capture: true, passive: false });
    window.addEventListener('pointerdown', engage, true);
    window.addEventListener('keydown', engage, true);
    window.addEventListener('message', onMessage);
    post({ kind: 'ready' });

    return () => {
      window.removeEventListener('wheel', handOver, { capture: true });
      window.removeEventListener('pointerdown', engage, true);
      window.removeEventListener('keydown', engage, true);
      window.removeEventListener('message', onMessage);
    };
  }, [framed]);
}
