/** Whether an address is a sandbox account's placeholder, which only keeping the sandbox replaces. */
export const isSandboxAddress = (email: string | null | undefined) => !!email?.endsWith('@sandbox.invalid');

/** Whether this page runs inside another page of the app, as the about page's live board does. */
export const isFramed = () => typeof window !== 'undefined' && window.self !== window.top;

/** What a framed app posts to the page around it once its layout has mounted. */
export const frameReadyMessage = 'sandbox-frame-ready';
