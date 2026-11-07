import { defineFrontendModule } from '~/lib/module';
import { endSession } from '~/modules/auth/end-session';
import { isFramed, isSandboxAddress } from '~/modules/sandbox/sandbox-account';
import { userStore } from '~/modules/user/user-store';

defineFrontendModule({
  name: 'sandboxes',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: "A visitor's own sandbox: the about page's live board, the bar on top of the app, and the share link that lets colleagues join.",
});

// The root page signs a remembered account back in; a sandbox ends on its own, after which that would land on sign-in
const forgetSandboxAccount = () => {
  if (isSandboxAddress(userStore.getState().lastUser?.email)) userStore.setState({ lastUser: null });
};
forgetSandboxAccount();
userStore.subscribe(forgetSandboxAccount);

const signInPath = '/auth/authenticate';

// The sign-in page sends a signed-in browser on to the app, a sandbox's included: a link there leaves the sandbox first
const leaveSandboxForSignIn = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement) || link.origin !== window.location.origin || link.pathname !== signInPath) return;
  if (isFramed() || !isSandboxAddress(userStore.getState().user?.email)) return;

  event.preventDefault();
  event.stopPropagation();
  // A sandbox whose session is gone already refuses the sign-out; the sign-in page is right either way
  void endSession({ wipe: true }).finally(() => window.location.assign(link.href));
};
if (typeof document !== 'undefined') document.addEventListener('click', leaveSandboxForSignIn, true);
