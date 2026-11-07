import { defineFrontendModule } from '~/lib/module';
import { endSession } from '~/modules/auth/end-session';
import { isDemoAddress, isFramed } from '~/modules/demo/demo-account';
import { userStore } from '~/modules/user/user-store';

defineFrontendModule({
  name: 'demos',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: "A visitor's own demo: the about page's live board, the bar on top of the app, and the share link that lets colleagues join.",
});

// The root page signs a remembered account back in; a demo ends on its own, after which that would land on sign-in
const forgetDemoAccount = () => {
  if (isDemoAddress(userStore.getState().lastUser?.email)) userStore.setState({ lastUser: null });
};
forgetDemoAccount();
userStore.subscribe(forgetDemoAccount);

const signInPath = '/auth/authenticate';

// The sign-in page sends a signed-in browser on to the app, a demo's included: a link there leaves the demo first
const leaveDemoForSignIn = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement) || link.origin !== window.location.origin || link.pathname !== signInPath) return;
  if (isFramed() || !isDemoAddress(userStore.getState().user?.email)) return;

  event.preventDefault();
  event.stopPropagation();
  // A demo whose session is gone already refuses the sign-out; the sign-in page is right either way
  void endSession({ wipe: true }).finally(() => window.location.assign(link.href));
};
if (typeof document !== 'undefined') document.addEventListener('click', leaveDemoForSignIn, true);
