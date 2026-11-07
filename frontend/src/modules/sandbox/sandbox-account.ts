import { userStore } from '~/modules/user/user-store';

/** Whether an address is a sandbox account's placeholder. */
export const isSandboxAddress = (email: string | null | undefined) => !!email?.endsWith('@sandbox.invalid');

/** Whether this page runs inside another page of the app, as the about page's live board does. */
export const isFramed = () => typeof window !== 'undefined' && window.self !== window.top;

/**
 * Whether the app shows a sandbox: in the about page's frame, or signed in to a sandbox account. Its view is the board
 * alone, in focus view, which it never stores: that setting is shared with every tab and the next account.
 */
export const isSandboxView = () => isFramed() || isSandboxAddress(userStore.getState().user?.email);

/** The `type` of every message between the about page and the sandbox in its frame. */
export const sandboxFrameMessage = 'sandbox-frame';

/**
 * From the frame: `ready` once its layout has mounted, `wheel` for a scroll it hands to the page while the visitor has
 * not pressed inside it, `engaged` at that first press. From the page: `release`, which hands the wheel back, and
 * `hold`, which keeps it in the frame while the frame fills the window.
 */
export type SandboxFrameMessageBody = { kind: 'ready' | 'engaged' | 'release' | 'hold' } | { kind: 'wheel'; deltaX: number; deltaY: number };
export type SandboxFrameMessage = SandboxFrameMessageBody & { type: typeof sandboxFrameMessage };

export const isSandboxFrameMessage = (data: unknown): data is SandboxFrameMessage =>
  typeof data === 'object' && data !== null && (data as { type?: unknown }).type === sandboxFrameMessage;
