/** Whether an address is a demo account's placeholder. */
export const isDemoAddress = (email: string | null | undefined) => !!email?.endsWith('@demo.invalid');

/** Whether this page runs inside another page of the app, as the about page's live board does. */
export const isFramed = () => typeof window !== 'undefined' && window.self !== window.top;

/** The `type` of every message between the about page and the demo in its frame. */
export const demoFrameMessage = 'demo-frame';

/**
 * From the frame: `ready` once its layout has mounted, `wheel` for a scroll it hands to the page while the visitor has
 * not pressed inside it, `engaged` at that first press. From the page: `release`, which hands the wheel back, and
 * `hold`, which keeps it in the frame while the frame fills the window.
 */
export type DemoFrameMessageBody = { kind: 'ready' | 'engaged' | 'release' | 'hold' } | { kind: 'wheel'; deltaX: number; deltaY: number };
export type DemoFrameMessage = DemoFrameMessageBody & { type: typeof demoFrameMessage };

export const isDemoFrameMessage = (data: unknown): data is DemoFrameMessage =>
  typeof data === 'object' && data !== null && (data as { type?: unknown }).type === demoFrameMessage;
