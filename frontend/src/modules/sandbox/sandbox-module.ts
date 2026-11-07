import { defineFrontendModule } from '~/lib/module';
import { isSandboxAddress } from '~/modules/sandbox/sandbox-account';
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
