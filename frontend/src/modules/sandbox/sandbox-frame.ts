import { useEffect } from 'react';
import { isSandboxFrameMessage, type SandboxFrameMessageBody, sandboxFrameMessage } from '~/modules/sandbox/sandbox-account';
import '~/modules/sandbox/sandbox-view.css';

const lineHeight = 16;

const post = (message: SandboxFrameMessageBody) => window.parent.postMessage({ type: sandboxFrameMessage, ...message }, window.location.origin);

/**
 * A sandbox shows the board alone, in the about page's frame and in a full window alike: focus view on the root
 * element, since the page's focus view container owns the body's class and the stored setting is shared with every tab.
 */
export function useSandboxView(shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    document.documentElement.classList.add('focus-view', 'sandbox-view');
    return () => document.documentElement.classList.remove('focus-view', 'sandbox-view');
  }, [shown]);
}

/**
 * The app inside the about page's frame hands the wheel to the page until the visitor presses inside, so a page
 * scrolled past the board keeps scrolling, and tells the page once its layout has mounted.
 */
export function useSandboxFrame(framed: boolean) {
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
      if (isSandboxFrameMessage(event.data) && event.data.kind === 'release') engaged = false;
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
